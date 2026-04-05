"""
Shared guest import logic for CSV, Excel, vCard, and JSON (Contact Picker) flows.
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

import vobject

from .models import Guest
from .utils import format_phone_with_country_code, get_country_code

STANDARD_FIELDS = frozenset(
    {'name', 'phone', 'email', 'relationship', 'notes', 'country_code', 'country_iso'}
)

MAX_JSON_IMPORT_GUESTS = 500


def _sanitize_phone_raw(raw: str) -> str:
    if not raw:
        return ''
    s = raw.strip()
    if s.lower().startswith('tel:'):
        s = s[4:].strip()
    return s


def _score_tel_type(type_params: Any) -> int:
    if not type_params:
        return 0
    types: List[str] = []
    if isinstance(type_params, list):
        for p in type_params:
            types.append(str(p).upper())
    else:
        types.append(str(type_params).upper())
    joined = ' '.join(types)
    if 'CELL' in joined or 'MOBILE' in joined:
        return 3
    if 'PREF' in joined:
        return 2
    return 1


def _pick_best_tel(vcard: Any) -> str:
    tels: List[Tuple[int, str]] = []
    for tel in getattr(vcard, 'tel_list', None) or []:
        val = getattr(tel, 'value', None) or ''
        val = _sanitize_phone_raw(str(val))
        if not val:
            continue
        params = getattr(tel, 'params', None) or {}
        typ = params.get('TYPE', '')
        score = _score_tel_type(typ)
        tels.append((score, val))
    if not tels:
        contents = getattr(vcard, 'contents', None) or {}
        for item in contents.get('tel', []) or []:
            val = getattr(item, 'value', None) or ''
            val = _sanitize_phone_raw(str(val))
            if not val:
                continue
            params = getattr(item, 'params', None) or {}
            typ = params.get('TYPE', '')
            score = _score_tel_type(typ)
            tels.append((score, val))
    if not tels:
        return ''
    tels.sort(key=lambda x: -x[0])
    return tels[0][1]


def _vcard_display_name(vcard: Any) -> str:
    fn = ''
    if hasattr(vcard, 'fn') and vcard.fn:
        fn = (vcard.fn.value or '').strip()
    if fn:
        return fn
    if hasattr(vcard, 'n') and vcard.n and vcard.n.value:
        parts = vcard.n.value
        if isinstance(parts, str):
            return parts.strip()
        family = (parts[0] or '').strip() if len(parts) > 0 else ''
        given = (parts[1] or '').strip() if len(parts) > 1 else ''
        composed = f'{given} {family}'.strip() or family or given
        return composed.strip()
    return ''


def _vcard_email(vcard: Any) -> str:
    for em in getattr(vcard, 'email_list', None) or []:
        v = str(getattr(em, 'value', None) or '').strip()
        if v:
            return v
    contents = getattr(vcard, 'contents', None) or {}
    for item in contents.get('email', []) or []:
        v = getattr(item, 'value', None) or ''
        v = str(v).strip()
        if v:
            return v
    return ''


def parse_vcf_bytes(raw_bytes: bytes) -> List[Tuple[str, Dict[str, str]]]:
    """
    Parse a vCard file. Returns list of (label, row_dict) with keys name, phone, email.
    Raises ValueError for decode/parse issues or empty contact list.
    """
    text = None
    for enc in ('utf-8-sig', 'utf-8', 'utf-16', 'utf-16-le', 'utf-16-be'):
        try:
            text = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError('Could not decode vCard file as UTF-8 or UTF-16.')

    results: List[Tuple[str, Dict[str, str]]] = []
    idx = 0
    try:
        for vcard in vobject.readComponents(text):
            idx += 1
            label = f'vCard {idx}'
            name = _vcard_display_name(vcard)
            phone = _pick_best_tel(vcard)
            email = _vcard_email(vcard)
            results.append(
                (label, {'name': name, 'phone': phone, 'email': email})
            )
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f'Invalid vCard file: {e}') from e

    if not results:
        raise ValueError('No contacts found in file.')
    return results


def process_guest_import_rows(
    event,
    labeled_rows: List[Tuple[str, Dict[str, str]]],
) -> Tuple[int, List[str]]:
    """
    Create guests from pre-normalized row dicts (keys already normalized like CSV import).

    labeled_rows: list of (error_label, row_dict) e.g. ("Row 2", {...}).
    """
    created = 0
    errors: List[str] = []
    event_country_code = get_country_code(event.country)

    for label, normalized_row in labeled_rows:
        name = normalized_row.get('name', '').strip()
        phone = normalized_row.get('phone', '').strip()

        if not name:
            errors.append(f'{label}: Name is required')
            continue

        if len(name) > 255:
            name = name[:255]

        if not phone:
            errors.append(f'{label}: Phone is required')
            continue

        country_iso = normalized_row.get('country_iso', '').strip().upper() or ''
        country_code_from_csv = normalized_row.get('country_code', '').strip()

        if country_iso:
            if len(country_iso) == 2:
                country_code = get_country_code(country_iso)
            else:
                errors.append(
                    f'{label}: Invalid country_iso format (must be 2 characters): {country_iso}'
                )
                continue
        elif country_code_from_csv:
            country_code = country_code_from_csv
            if not country_code.startswith('+'):
                country_code = '+' + country_code.lstrip('+')
        else:
            country_code = event_country_code

        if not phone.startswith('+'):
            phone = format_phone_with_country_code(phone, country_code)

        if not phone.startswith('+') or len(phone.replace('+', '')) < 10:
            errors.append(f'{label}: Invalid phone number format: {phone}')
            continue

        if len(phone) > 20:
            errors.append(f'{label}: Phone number is too long after formatting')
            continue

        if Guest.objects.filter(event=event, phone=phone).exists():
            errors.append(f'{label}: Phone {phone} already exists')
            continue

        email = normalized_row.get('email', '').strip() or None
        relationship = normalized_row.get('relationship', '').strip() or ''
        notes = normalized_row.get('notes', '').strip() or ''

        custom_fields: Dict[str, str] = {}
        for key, value in normalized_row.items():
            if key not in STANDARD_FIELDS and value:
                custom_fields[key] = value

        try:
            Guest.objects.create(
                event=event,
                name=name,
                phone=phone,
                email=email,
                relationship=relationship,
                notes=notes,
                country_iso=country_iso[:2] if country_iso else '',
                custom_fields=custom_fields,
            )
            created += 1
        except Exception as e:
            errors.append(f'{label}: Failed to create guest - {str(e)}')
            continue

    return created, errors
