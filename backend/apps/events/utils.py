"""
Utility functions for events app
"""

import os
import uuid
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


def upload_to_s3(file, folder='events'):
    """
    Upload a file to AWS S3 and return the public URL
    
    Args:
        file: Django UploadedFile object or file-like object
        folder: S3 folder path (default: 'events')
    
    Returns:
        Public S3 URL string
    
    Raises:
        Exception: If upload fails
    """
    # Get S3 configuration from settings
    bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
    region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-east-1')
    access_key = getattr(settings, 'AWS_ACCESS_KEY_ID', '')
    secret_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')
    
    if not bucket_name or not access_key or not secret_key:
        raise Exception('S3 configuration is missing. Please set AWS_STORAGE_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in settings.')
    
    # Initialize S3 client
    s3_client = boto3.client(
        's3',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=region
    )
    
    # Generate unique filename
    file_extension = os.path.splitext(file.name)[1] if hasattr(file, 'name') else '.jpg'
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_id = str(uuid.uuid4())[:8]
    filename = f"{folder}/{timestamp}_{unique_id}{file_extension}"
    
    try:
        # Upload file to S3
        # Set content type based on file extension
        content_type_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
            '.gif': 'image/gif',
        }
        content_type = content_type_map.get(file_extension.lower(), 'image/jpeg')
        
        # Read file content
        file.seek(0)  # Reset file pointer
        file_content = file.read()
        
        # Upload to S3 with public read access
        s3_client.put_object(
            Bucket=bucket_name,
            Key=filename,
            Body=file_content,
            ContentType=content_type,
            ACL='public-read'  # Make file publicly accessible
        )
        
        # Construct public URL
        # Format: https://bucket-name.s3.region.amazonaws.com/folder/filename
        if region == 'us-east-1':
            # us-east-1 uses different URL format
            url = f"https://{bucket_name}.s3.amazonaws.com/{filename}"
        else:
            url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{filename}"
        
        return url
        
    except ClientError as e:
        raise Exception(f'Failed to upload file to S3: {str(e)}')
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
    
    # 1. Food Saved: Guests from list who didn't RSVP
    total_guests = event.guest_list.count()
    guests_with_rsvp_ids = event.rsvps.filter(
        guest__isnull=False
    ).values_list('guest_id', flat=True).distinct()
    guests_without_rsvp = total_guests - len(guests_with_rsvp_ids)
    
    # Calculate plates saved using guests_count from RSVPs
    # For guests who RSVP'd 'no', we still saved plates (they didn't come)
    rsvps_no = event.rsvps.filter(will_attend='no', guest__isnull=False)
    plates_saved_from_no = sum(rsvp.guests_count for rsvp in rsvps_no)
    # For guests who didn't RSVP, assume 1 plate per guest
    plates_saved_from_no_rsvp = guests_without_rsvp
    total_plates_saved = plates_saved_from_no + plates_saved_from_no_rsvp
    
    # 2. Paper Saved: Web RSVPs (source_channel='link', not 'qr')
    web_rsvps = event.rsvps.filter(source_channel='link').count()
    
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

