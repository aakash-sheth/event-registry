"""
Utility functions for events app
"""

import os
import uuid
import hashlib
from datetime import datetime
import boto3
from botocore.exceptions import ClientError
from django.conf import settings
from .country_codes import COUNTRY_CODES, PHONE_TO_ISO, DEFAULT_COUNTRY_CODE, DEFAULT_COUNTRY_ISO


def get_country_code(country_iso: str) -> str:
    """
    Get phone country code from ISO 3166-1 alpha-2 country code
    
    Args:
        country_iso: Two-letter country code (e.g., 'IN', 'US')
    
    Returns:
        Phone country code with + prefix (e.g., '+91', '+1')
    """
    if not country_iso:
        return DEFAULT_COUNTRY_CODE
    return COUNTRY_CODES.get(country_iso.upper(), DEFAULT_COUNTRY_CODE)


def detect_country_code_from_phone(phone_digits: str) -> tuple[str, str]:
    """
    Detect country code from phone number by trying to match known codes
    Takes last 10 digits as local number, remaining as country code
    
    Args:
        phone_digits: Phone number digits only (no +, spaces, etc.)
    
    Returns:
        Tuple of (detected_country_code, local_number)
        If no match found, returns (None, phone_digits)
    """
    # Try to match country codes from longest to shortest
    # Sort by length (descending) to match longer codes first (e.g., +1 before +)
    sorted_codes = sorted(set(COUNTRY_CODES.values()), key=lambda x: len(x.replace('+', '')), reverse=True)
    
    for code in sorted_codes:
        code_digits = code.replace('+', '')
        if phone_digits.startswith(code_digits):
            # Found a match - extract local number (everything after country code)
            local_number = phone_digits[len(code_digits):]
            # Validate: local number should be at least 7 digits (typical minimum)
            if len(local_number) >= 7:
                return code, local_number
    
    return None, phone_digits


def format_phone_with_country_code(phone: str, country_code: str = None) -> str:
    """
    Format phone number with country code
    Smart detection: takes last 10 digits as phone, remaining as country code
    
    Args:
        phone: Phone number (may or may not have country code)
        country_code: Optional default country code with + prefix (e.g., '+91')
                     If None, will try to detect from phone number
    
    Returns:
        Formatted phone number with country code (e.g., '+919876543210')
    """
    # Remove any whitespace, +, dashes, parentheses
    phone_clean = phone.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    
    # If already starts with +, check if it has a valid country code
    if phone_clean.startswith('+'):
        # Remove + and check if it matches a known country code
        phone_digits = phone_clean[1:]
        detected_code, local_number = detect_country_code_from_phone(phone_digits)
        if detected_code:
            return f"{detected_code}{local_number}"
        # If no match but has +, return as is (might be valid but not in our list)
        return phone_clean
    
    # Remove any non-digit characters
    phone_digits = ''.join(filter(str.isdigit, phone_clean))
    
    # If no digits, return original
    if not phone_digits:
        return phone_clean
    
    # If country code is explicitly provided, use it instead of trying to detect
    # (detection can be wrong if the number happens to start with digits matching a country code)
    if country_code:
        country_code_digits = country_code.replace('+', '')
        
        # Check if phone already starts with country code digits
        if phone_digits.startswith(country_code_digits):
            # Phone already has country code, just add +
            return f"+{phone_digits}"
        
        # Check if phone starts with 0 (common in India - remove leading 0)
        if phone_digits.startswith('0') and country_code == '+91':
            phone_digits = phone_digits[1:]
        
        # Smart parsing: if phone is longer than 10 digits, try to extract country code
        # Strategy: Take last 10 digits as local number, remaining as country code
        if len(phone_digits) > 10:
            # Try different splits: last 10, last 9, last 8, etc. as local number
            # and match remaining as country code
            for local_len in range(10, 7, -1):  # Try 10, 9, 8 digits as local number
                if len(phone_digits) <= local_len:
                    continue
                local_number = phone_digits[-local_len:]
                potential_code_digits = phone_digits[:-local_len]
                
                # Try to match this as a country code
                potential_code = f"+{potential_code_digits}"
                if potential_code in COUNTRY_CODES.values():
                    return f"{potential_code}{local_number}"
                
                # Also try matching if potential_code_digits ends with a known country code
                # (in case there are extra digits)
                for code in COUNTRY_CODES.values():
                    code_digits = code.replace('+', '')
                    if potential_code_digits.endswith(code_digits):
                        # Found a match - use the matched code
                        return f"{code}{local_number}"
        
        # Default: add provided country code
        return f"{country_code}{phone_digits}"
    
    # No country code provided - try to detect from the number itself
    detected_code, local_number = detect_country_code_from_phone(phone_digits)
    
    if detected_code:
        # Successfully detected country code
        return f"{detected_code}{local_number}"
        country_code_digits = country_code.replace('+', '')
        
        # Check if phone already starts with country code digits
        if phone_digits.startswith(country_code_digits):
            # Phone already has country code, just add +
            return f"+{phone_digits}"
        
        # Check if phone starts with 0 (common in India - remove leading 0)
        if phone_digits.startswith('0') and country_code == '+91':
            phone_digits = phone_digits[1:]
        
        # Smart parsing: if phone is longer than 10 digits, try to extract country code
        # Strategy: Take last 10 digits as local number, remaining as country code
        if len(phone_digits) > 10:
            # Try different splits: last 10, last 9, last 8, etc. as local number
            # and match remaining as country code
            for local_len in range(10, 7, -1):  # Try 10, 9, 8 digits as local number
                if len(phone_digits) <= local_len:
                    continue
                local_number = phone_digits[-local_len:]
                potential_code_digits = phone_digits[:-local_len]
                
                # Try to match this as a country code
                potential_code = f"+{potential_code_digits}"
                if potential_code in COUNTRY_CODES.values():
                    return f"{potential_code}{local_number}"
                
                # Also try matching if potential_code_digits ends with a known country code
                # (in case there are extra digits)
                for code in COUNTRY_CODES.values():
                    code_digits = code.replace('+', '')
                    if potential_code_digits.endswith(code_digits):
                        # Found a match - use the matched code
                        return f"{code}{local_number}"
        
        # Default: add provided country code
        return f"{country_code}{phone_digits}"
    
    # No country code provided and couldn't detect - use default
    return f"{DEFAULT_COUNTRY_CODE}{phone_digits}"


def parse_phone_number(phone: str) -> tuple[str, str]:
    """
    Parse phone number to extract country code and local number
    
    Args:
        phone: Full phone number with country code (e.g., '+919876543210')
    
    Returns:
        Tuple of (country_code, local_number)
    """
    phone = phone.strip()
    if not phone.startswith('+'):
        return DEFAULT_COUNTRY_CODE, phone
    
    # Try to match known country codes (longest first)
    sorted_codes = sorted(COUNTRY_CODES.values(), key=len, reverse=True)
    for code in sorted_codes:
        code_digits = code.lstrip('+')
        if phone.startswith(code):
            local_number = phone[len(code):]
            return code, local_number
    
    # Default to India if no match
    return DEFAULT_COUNTRY_CODE, phone.lstrip('+')


def upload_to_s3(file, event_id, folder='events'):
    """
    Upload a file to AWS S3 or local storage (in DEBUG mode) and return the public URL
    
    Uses content hash for filename to enable automatic deduplication within events.
    
    Args:
        file: Django UploadedFile object or file-like object
        event_id: Event ID for organizing files by event
        folder: S3 folder path (default: 'events')
    
    Returns:
        Public URL string (S3 URL in production, local URL in development)
    
    Raises:
        Exception: If upload fails
    """
    # Validate event_id
    if not event_id or not isinstance(event_id, int):
        raise ValueError('event_id must be a valid integer')
    
    # Get file extension first
    file_extension = os.path.splitext(file.name)[1] if hasattr(file, 'name') else '.jpg'
    if not file_extension:
        file_extension = '.jpg'
    
    # Check if we should use local storage (DEBUG mode and S3 credentials missing)
    debug_mode = getattr(settings, 'DEBUG', False)
    # Check both AWS_STORAGE_BUCKET_NAME and AWS_S3_BUCKET for compatibility
    bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '') or os.environ.get('AWS_S3_BUCKET', '')
    access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', '') or os.environ.get('AWS_ACCESS_KEY_ID', '')
    secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', '') or os.environ.get('AWS_SECRET_ACCESS_KEY', '')
    
    use_local_storage = debug_mode and (not bucket_name or (not access_key or not secret_key))
    
    # Calculate hash using streaming (more memory efficient for large files)
    file.seek(0)  # Reset file pointer
    hash_obj = hashlib.sha256()
    chunk_size = 8192  # 8KB chunks
    file_chunks = []  # Store chunks for local storage if needed
    
    # Read file in chunks to calculate hash
    while True:
        chunk = file.read(chunk_size)
        if not chunk:
            break
        hash_obj.update(chunk)
        # Store chunks for local storage (only if needed)
        if use_local_storage:
            file_chunks.append(chunk)
    
    file_hash = hash_obj.hexdigest()
    
    # Generate filename: events/{event_id}/{hash}.jpg
    filename = f"{folder}/{event_id}/{file_hash}{file_extension}"
    
    if use_local_storage:
        # Local file storage for development
        media_root = getattr(settings, 'MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'media'))
        upload_dir = os.path.join(media_root, 'uploads', folder, str(event_id))
        
        # Create directory if it doesn't exist
        os.makedirs(upload_dir, exist_ok=True)
        
        # Save file locally using stored chunks
        file_path = os.path.join(upload_dir, f"{file_hash}{file_extension}")
        with open(file_path, 'wb') as f:
            for chunk in file_chunks:
                f.write(chunk)
        
        # Return local URL
        media_url = getattr(settings, 'MEDIA_URL', '/media/')
        return f"{media_url}uploads/{filename}"
    else:
        # S3 upload for production
        if not bucket_name:
            raise Exception('S3 bucket name is missing. Please set AWS_STORAGE_BUCKET_NAME or AWS_S3_BUCKET in settings.')
        
        region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1')
        
        # Initialize S3 client
        # If credentials are provided, use them; otherwise use IAM role (ECS best practice)
        s3_kwargs = {
            'service_name': 's3',
            'region_name': region
        }
        
        # Only add credentials if explicitly provided (for local dev or if using access keys)
        # In ECS, boto3 will automatically use the task role credentials if credentials are not provided
        if access_key and secret_key:
            s3_kwargs['aws_access_key_id'] = access_key
            s3_kwargs['aws_secret_access_key'] = secret_key
        
        s3_client = boto3.client(**s3_kwargs)
        
        try:
            # Set content type based on file extension
            content_type_map = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.gif': 'image/gif',
            }
            content_type = content_type_map.get(file_extension.lower(), 'image/jpeg')
            
            # Reset file pointer to beginning for S3 upload
            # (We read through it for hash calculation, so need to reset)
            file.seek(0)
            
            # Upload to S3 (bucket policy handles public read access, no ACL needed)
            # If file with same hash exists, it will be overwritten (automatic deduplication)
            # Use file object directly for streaming upload (more memory efficient)
            s3_client.put_object(
                Bucket=bucket_name,
                Key=filename,
                Body=file,  # Use file object directly (boto3 handles streaming)
                ContentType=content_type,
                CacheControl='public, max-age=31536000, immutable',  # 1 year cache for CloudFront
            )
            
            # Construct public URL - prefer CloudFront if configured, otherwise use S3
            # Get CloudFront image domain from environment
            cloudfront_image_domain = getattr(settings, 'CLOUDFRONT_IMAGE_DOMAIN', '') or os.environ.get('CLOUDFRONT_IMAGE_DOMAIN', '')
            
            if cloudfront_image_domain:
                # Use CloudFront URL
                url = f"https://{cloudfront_image_domain}/{filename}"
            else:
                # Fallback to S3 URL (for backward compatibility)
                if region == 'us-east-1':
                    # us-east-1 uses different URL format
                    url = f"https://{bucket_name}.s3.amazonaws.com/{filename}"
                else:
                    url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{filename}"
            
            return url
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            error_message = e.response.get('Error', {}).get('Message', str(e))
            raise Exception(f'Failed to upload file to S3 (Error: {error_code}): {error_message}')
        except Exception as e:
            raise Exception(f'Error uploading file: {str(e)}')


def calculate_event_impact(event):
    """
    Calculate sustainability impact for an expired event.
    Returns None if event is not expired.
    
    Impact metrics:
    1. Food Saved: Guests from list who didn't RSVP (plates saved)
    2. Paper Saved: Web RSVPs (source_channel='link', not 'qr')
    3. Gifts Received: Paid orders with physical items
    4. Paper Saved on Gifts: Cash gifts and donations (no physical gift cards)
    """
    from datetime import date
    from django.db.models import Sum, Q
    
    # Check if event is expired
    # Handle case where expiry_date field might not exist yet (migration not run)
    try:
        expiry = event.expiry_date or event.date
    except AttributeError:
        # expiry_date field doesn't exist yet, use event.date
        expiry = event.date
    if not expiry or expiry >= date.today():
        return None  # Event not expired
    
    # 1. Food Saved: Guests from list who didn't RSVP (exclude removed guests and RSVPs)
    total_guests = event.guest_list.filter(is_removed=False).count()
    guests_with_rsvp_ids = event.rsvps.filter(
        guest__isnull=False,
        guest__is_removed=False,
        is_removed=False
    ).values_list('guest_id', flat=True).distinct()
    guests_without_rsvp = total_guests - len(guests_with_rsvp_ids)
    
    # Calculate plates saved using guests_count from RSVPs
    # For guests who RSVP'd 'no', we still saved plates (they didn't come)
    rsvps_no = event.rsvps.filter(will_attend='no', guest__isnull=False, guest__is_removed=False, is_removed=False)
    plates_saved_from_no = sum(rsvp.guests_count for rsvp in rsvps_no)
    # For guests who didn't RSVP, assume 1 plate per guest
    plates_saved_from_no_rsvp = guests_without_rsvp
    total_plates_saved = plates_saved_from_no + plates_saved_from_no_rsvp
    
    # 2. Paper Saved: Web RSVPs (source_channel='link', not 'qr', exclude removed)
    web_rsvps = event.rsvps.filter(source_channel='link', is_removed=False).count()
    
    # 3. Gifts Received: Paid orders with physical items
    # Check if item_type field exists (migration might not be run yet)
    try:
        # Try to filter by item_type - if field doesn't exist, this will fail
        paid_orders_with_items = event.orders.filter(
            status='paid',
            item__isnull=False,
            item__item_type='physical'  # Only physical gifts
        )
        total_gifts = paid_orders_with_items.count()
        total_gift_value = paid_orders_with_items.aggregate(
            total=Sum('amount_inr')
        )['total'] or 0
        
        # 4. Paper Saved on Gifts: Cash gifts and donations (no physical gift cards)
        cash_and_donation_orders = event.orders.filter(
            status='paid'
        ).filter(
            Q(item__isnull=True) |  # Cash gifts (no item)
            Q(item__item_type__in=['cash', 'donation'])  # Cash/donation items
        )
        paper_saved_on_gifts = cash_and_donation_orders.count()
    except Exception:
        # item_type field doesn't exist yet - fallback to all paid orders with items
        paid_orders_with_items = event.orders.filter(
            status='paid',
            item__isnull=False
        )
        total_gifts = paid_orders_with_items.count()
        total_gift_value = paid_orders_with_items.aggregate(
            total=Sum('amount_inr')
        )['total'] or 0
        
        # For paper saved, only count orders without items (cash gifts)
        cash_and_donation_orders = event.orders.filter(
            status='paid',
            item__isnull=True
        )
        paper_saved_on_gifts = cash_and_donation_orders.count()
    
    return {
        'food_saved': {
            'guests_without_rsvp': guests_without_rsvp,
            'plates_saved': total_plates_saved,
            'description': 'Plates saved from guests who didn\'t RSVP or declined'
        },
        'paper_saved': {
            'web_rsvps': web_rsvps,
            'description': 'Paper invitations saved (RSVPs via web link, not QR code)'
        },
        'gifts_received': {
            'total_gifts': total_gifts,
            'total_value_paise': total_gift_value,
            'total_value_rupees': total_gift_value / 100,
            'description': 'Physical gifts received from registry'
        },
        'paper_saved_on_gifts': {
            'cash_gifts': paper_saved_on_gifts,
            'description': 'Paper saved on cash gifts and donations (no physical gift cards)'
        }
    }


def normalize_csv_header(header: str) -> str:
    """
    Normalize CSV column header to variable name format.
    
    Rules:
    - Trim spaces
    - Lowercase
    - Replace spaces with underscores
    - Remove special characters except underscores
    
    Args:
        header: Original CSV column header (e.g., "Room Number", "Table #")
    
    Returns:
        Normalized key (e.g., "room_number", "table_")
    """
    import re
    # Trim and lowercase
    normalized = header.strip().lower()
    # Replace spaces with underscores
    normalized = normalized.replace(' ', '_')
    # Remove special characters except underscores
    normalized = re.sub(r'[^a-z0-9_]', '', normalized)
    # Remove multiple consecutive underscores
    normalized = re.sub(r'_+', '_', normalized)
    # Remove leading/trailing underscores
    normalized = normalized.strip('_')
    return normalized


def render_template_with_guest(template_text: str, event, guest=None, base_url: str = None):
    """
    Render WhatsApp template with all variables (default + custom fields).
    
    Args:
        template_text: Template text with variables like [name], [event_title], etc.
        event: Event instance
        guest: Guest instance (optional, for guest-specific variables)
        base_url: Base URL for generating invite links (optional)
    
    Returns:
        Tuple of (rendered_message, warnings_dict)
        warnings_dict contains:
        - unresolved_variables: List of variables that couldn't be resolved
        - missing_custom_fields: List of custom field keys that are missing for this guest
    """
    from datetime import date
    import urllib.parse
    
    warnings = {
        'unresolved_variables': [],
        'missing_custom_fields': [],
    }
    
    message = template_text
    
    # Default variables
    replacements = {}
    
    # Guest name
    if guest:
        replacements['[name]'] = guest.name
    else:
        replacements['[name]'] = ''
    
    # Event title
    replacements['[event_title]'] = event.title or 'Event'
    
    # Event date
    if event.date:
        date_str = event.date.strftime('%B %d, %Y')
    else:
        date_str = 'TBD'
    replacements['[event_date]'] = date_str
    
    # Event URL (with guest token if available)
    if base_url:
        if guest and guest.guest_token:
            # Generate guest-scoped invite link
            invite_url = f"{base_url}/invite/{event.slug}?g={guest.guest_token}"
        else:
            # Public invite link
            invite_url = f"{base_url}/invite/{event.slug}"
    else:
        invite_url = f"https://example.com/invite/{event.slug}"
    replacements['[event_url]'] = invite_url
    
    # Host name
    replacements['[host_name]'] = event.host.name or 'Host'
    
    # Event location
    replacements['[event_location]'] = event.city or 'Location TBD'
    
    # Map direction
    if event.city:
        encoded_location = urllib.parse.quote(event.city)
        replacements['[map_direction]'] = f"https://maps.google.com/?q={encoded_location}"
    else:
        replacements['[map_direction]'] = ''
    
    # Custom fields from CSV (if guest provided)
    if guest and guest.custom_fields:
        custom_metadata = event.custom_fields_metadata or {}
        for normalized_key, value in guest.custom_fields.items():
            variable_key = f'[{normalized_key}]'
            if value:
                replacements[variable_key] = str(value)
            else:
                replacements[variable_key] = '—'
                warnings['missing_custom_fields'].append(normalized_key)
    
    # Replace all known variables
    import re
    for variable, value in replacements.items():
        # Escape special regex characters in variable
        escaped_variable = re.escape(variable)
        message = re.sub(escaped_variable, value, message)
    
    # Find unresolved variables (variables in template that weren't replaced)
    unresolved_pattern = r'\[([a-z0-9_]+)\]'
    unresolved_matches = re.findall(unresolved_pattern, message, re.IGNORECASE)
    
    # Filter out variables that were already replaced (check if they still exist in message)
    for match in unresolved_matches:
        variable = f'[{match}]'
        if variable in message:
            warnings['unresolved_variables'].append(variable)
    
    return message, warnings


def render_description_with_guest(description_text: str, event, guest=None, base_url: str = None):
    """
    Render event description with guest-specific variables only.
    Only supports [name] and custom CSV fields - other variables are excluded
    since they're already displayed on the invitation page.
    
    Args:
        description_text: Description HTML/text with variables like [name], [custom_field]
        event: Event instance
        guest: Guest instance (optional, for guest-specific variables)
        base_url: Base URL (optional, not used but kept for consistency)
    
    Returns:
        Tuple of (rendered_description, warnings_dict)
        warnings_dict contains:
        - unresolved_variables: List of variables that couldn't be resolved
        - missing_custom_fields: List of custom field keys that are missing for this guest
    """
    import re
    
    warnings = {
        'unresolved_variables': [],
        'missing_custom_fields': [],
    }
    
    description = description_text
    
    # Only guest-specific variables allowed
    replacements = {}
    
    # Guest name
    if guest:
        replacements['[name]'] = guest.name
    else:
        # If no guest, replace [name] with empty string (so it doesn't show as [name] in description)
        replacements['[name]'] = ''
    
    # Custom fields from CSV (only if guest provided)
    if guest and guest.custom_fields:
        custom_metadata = event.custom_fields_metadata or {}
        for normalized_key, value in guest.custom_fields.items():
            variable_key = f'[{normalized_key}]'
            if value:
                replacements[variable_key] = str(value)
            else:
                replacements[variable_key] = '—'
                warnings['missing_custom_fields'].append(normalized_key)
    
    # Replace all known variables
    for variable, value in replacements.items():
        # Escape special regex characters in variable
        escaped_variable = re.escape(variable)
        description = re.sub(escaped_variable, value, description)
    
    # Find unresolved variables (excluding event-related ones that are intentionally not supported)
    unresolved_pattern = r'\[([a-z0-9_]+)\]'
    unresolved_matches = re.findall(unresolved_pattern, description, re.IGNORECASE)
    
    # Filter out variables that were already replaced
    for match in unresolved_matches:
        variable = f'[{match}]'
        if variable in description:
            # Only warn about non-event variables (event variables are intentionally not supported)
            event_variables = ['event_title', 'event_date', 'event_location', 'event_url', 'map_direction', 'host_name']
            if match.lower() not in event_variables:
                warnings['unresolved_variables'].append(variable)
    
    return description, warnings

