"""
Utility functions for events app
"""

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
    
    # Try to detect country code from the number itself
    detected_code, local_number = detect_country_code_from_phone(phone_digits)
    
    if detected_code:
        # Successfully detected country code
        return f"{detected_code}{local_number}"
    
    # No country code detected - use provided default or try smart parsing
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

