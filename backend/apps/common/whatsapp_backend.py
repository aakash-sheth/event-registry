"""
WhatsApp backend using Meta Cloud API (Graph API v19.0).

Usage:
    from apps.common.whatsapp_backend import send_whatsapp_message, replace_template_variables

Meta Cloud API docs: https://developers.facebook.com/docs/whatsapp/cloud-api/messages
"""
import hashlib
import hmac
import logging
from urllib.parse import quote

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def replace_template_variables(template_text: str, guest, event) -> str:
    """
    Python equivalent of frontend/lib/whatsapp.ts replaceTemplateVariables().

    Resolves all standard variables ([name], [event_title], [event_date],
    [event_url], [host_name], [event_location], [map_direction]) plus any
    custom fields stored in guest.custom_fields.

    Parameters
    ----------
    template_text : str
        Raw template body with bracketed variable placeholders.
    guest : Guest | None
        Guest ORM instance. May be None for preview/test renders.
    event : Event
        Event ORM instance.

    Returns
    -------
    str
        Message with all known variables substituted.
    """
    frontend = getattr(settings, 'FRONTEND_ORIGIN', 'https://ekfern.com')

    # Build human-readable event date string
    event_date_str = 'TBD'
    if getattr(event, 'date', None):
        try:
            # %-d removes the leading zero on day (Linux/macOS only)
            event_date_str = event.date.strftime('%B %-d, %Y')
        except Exception:
            event_date_str = str(event.date)

    location = getattr(event, 'city', '') or ''
    map_link = ''
    if location:
        map_link = f"https://maps.google.com/?q={quote(location)}"

    # Build personalised invite URL — include guest token when available
    guest_url = f"{frontend}/invite/{event.slug}"
    if guest and getattr(guest, 'guest_token', None):
        guest_url = f"{frontend}/invite/{event.slug}?g={guest.guest_token}"

    # Resolve host name from the event's owner
    host_name = ''
    host = getattr(event, 'host', None)
    if host:
        host_name = (
            getattr(host, 'name', '')
            or getattr(host, 'get_full_name', lambda: '')()
            or ''
        )

    standard_replacements = {
        '[name]': (guest.name if guest else '') or '',
        '[event_title]': getattr(event, 'title', '') or '',
        '[event_date]': event_date_str,
        '[event_url]': guest_url,
        '[host_name]': host_name,
        '[event_location]': location,
        '[map_direction]': map_link,
    }

    message = template_text
    for var, value in standard_replacements.items():
        message = message.replace(var, str(value))

    # Substitute custom fields stored in guest.custom_fields (dict)
    if guest and isinstance(getattr(guest, 'custom_fields', None), dict):
        for raw_key, raw_val in guest.custom_fields.items():
            key = str(raw_key).lower().strip().replace(' ', '_')
            val = str(raw_val).strip() if raw_val else '\u2014'  # em dash fallback
            message = message.replace(f'[{key}]', val)

    return message


def send_whatsapp_message(
    to_phone: str,
    message_body: str,
    *,
    message_mode: str = 'approved_template',
    meta_template_name: str = '',
    meta_template_language: str = 'en',
    campaign_recipient_id: int = None,
) -> dict:
    """
    Send a single WhatsApp message via Meta Cloud API.

    Parameters
    ----------
    to_phone : str
        Phone in +CCXXXXXXXXXX format. The leading '+' is stripped for Meta.
    message_body : str
        Fully resolved message text (variables already replaced).
    message_mode : str
        'freeform' or 'approved_template'.
    meta_template_name : str
        Required when message_mode == 'approved_template'.
    meta_template_language : str
        Language code, default 'en'.
    campaign_recipient_id : int | None
        Optional CampaignRecipient PK stored in the NotificationLog payload.

    Returns
    -------
    dict
        Keys: success (bool), whatsapp_message_id (str | None), error (str | None).
    """
    if not getattr(settings, 'WHATSAPP_ENABLED', False):
        logger.warning(
            '[WhatsApp] WHATSAPP_ENABLED is False — skipping send to %s', to_phone
        )
        return {'success': False, 'whatsapp_message_id': None, 'error': 'WhatsApp disabled'}

    phone_number_id = getattr(settings, 'WHATSAPP_PHONE_NUMBER_ID', '')
    access_token = getattr(settings, 'WHATSAPP_ACCESS_TOKEN', '')

    if not phone_number_id or not access_token:
        logger.error(
            '[WhatsApp] Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN'
        )
        return {
            'success': False,
            'whatsapp_message_id': None,
            'error': 'Missing Meta credentials',
        }

    # Meta expects the number without the leading '+'
    to_number = to_phone.lstrip('+')

    url = f"https://graph.facebook.com/v19.0/{phone_number_id}/messages"
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }

    if message_mode == 'approved_template':
        payload = _build_approved_template_payload(
            to_number, meta_template_name, meta_template_language, message_body
        )
    else:
        # Free-form text — only valid within a 24-hour customer-initiated window
        payload = {
            'messaging_product': 'whatsapp',
            'to': to_number,
            'type': 'text',
            'text': {'body': message_body},
        }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        wamid = data.get('messages', [{}])[0].get('id', '')
        _log_notification(
            to_phone, message_body,
            status='sent', wamid=wamid,
            recipient_id=campaign_recipient_id,
        )
        logger.info('[WhatsApp] Sent to %s wamid=%s', to_phone, wamid)
        return {'success': True, 'whatsapp_message_id': wamid, 'error': None}

    except requests.exceptions.Timeout:
        err = 'Meta API timeout'
        logger.warning('[WhatsApp] Timeout sending to %s', to_phone)
        _log_notification(
            to_phone, message_body,
            status='failed', error=err,
            recipient_id=campaign_recipient_id,
        )
        return {'success': False, 'whatsapp_message_id': None, 'error': err}

    except requests.exceptions.HTTPError as exc:
        err = f'Meta API HTTP {exc.response.status_code}: {exc.response.text[:300]}'
        logger.warning('[WhatsApp] HTTP error sending to %s: %s', to_phone, err)
        _log_notification(
            to_phone, message_body,
            status='failed', error=err,
            recipient_id=campaign_recipient_id,
        )
        return {'success': False, 'whatsapp_message_id': None, 'error': err}

    except Exception as exc:  # noqa: BLE001
        err = f'Unexpected error: {exc}'
        logger.error('[WhatsApp] Unexpected error sending to %s: %s', to_phone, err)
        _log_notification(
            to_phone, message_body,
            status='failed', error=err,
            recipient_id=campaign_recipient_id,
        )
        return {'success': False, 'whatsapp_message_id': None, 'error': err}


def verify_webhook_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Verify the X-Hub-Signature-256 header from Meta webhook POSTs.

    Returns True if the signature is valid.
    - DEBUG mode: if WHATSAPP_APP_SECRET is not set, logs a warning and allows through.
    - Production: if WHATSAPP_APP_SECRET is not set, rejects all webhook POSTs (fail closed).
    Always uses constant-time comparison to prevent timing attacks.
    """
    app_secret = getattr(settings, 'WHATSAPP_APP_SECRET', '')
    if not app_secret:
        if getattr(settings, 'DEBUG', False):
            logger.warning(
                '[WhatsApp] WHATSAPP_APP_SECRET not set — skipping webhook verification (DEBUG only)'
            )
            return True
        logger.error(
            '[WhatsApp] WHATSAPP_APP_SECRET not configured — rejecting webhook POST (set it in env)'
        )
        return False  # fail closed in production

    if not signature_header.startswith('sha256='):
        return False

    expected = 'sha256=' + hmac.new(
        app_secret.encode('utf-8'), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature_header, expected)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _build_approved_template_payload(
    to_number: str,
    template_name: str,
    language_code: str,
    body_text: str,
) -> dict:
    """
    Build the Meta Cloud API payload for a pre-approved template.

    The body component passes the fully resolved message as a single text
    parameter. Extend the `components` list here if you need to add
    header images, footer text, or quick-reply buttons.
    """
    return {
        'messaging_product': 'whatsapp',
        'to': to_number,
        'type': 'template',
        'template': {
            'name': template_name,
            'language': {'code': language_code},
            'components': [
                {
                    'type': 'body',
                    'parameters': [{'type': 'text', 'text': body_text}],
                }
            ],
        },
    }


def _log_notification(
    to_phone: str,
    body: str,
    *,
    status: str,
    error: str = '',
    wamid: str = '',
    recipient_id: int = None,
) -> None:
    """
    Write an entry to NotificationLog.

    Failures inside this helper must never propagate to the caller — the
    send result has already been returned and this is best-effort audit logging.
    """
    try:
        from apps.notifications.models import NotificationLog  # local import to avoid circular deps

        payload = {
            'body_preview': body[:200],
            'wamid': wamid,
        }
        if recipient_id is not None:
            payload['campaign_recipient_id'] = recipient_id

        NotificationLog.objects.create(
            channel='whatsapp',
            to=to_phone,
            template='campaign',
            payload_json=payload,
            status=status,
            last_error=error,
        )
    except Exception as log_exc:  # noqa: BLE001
        logger.error(
            '[WhatsApp] Failed to write NotificationLog for %s: %s', to_phone, log_exc
        )
