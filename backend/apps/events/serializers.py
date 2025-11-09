from rest_framework import serializers
from .models import Event, RSVP, Guest
from apps.users.serializers import UserSerializer
from .utils import get_country_code, format_phone_with_country_code


class EventSerializer(serializers.ModelSerializer):
    # Only include minimal host info for privacy (name only, no email)
    host_name = serializers.CharField(source='host.name', read_only=True, allow_null=True)
    country_code = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = ('id', 'host_name', 'slug', 'title', 'event_type', 'date', 'city', 'country', 'country_code', 'is_public', 'has_rsvp', 'has_registry', 'banner_image', 'description', 'additional_photos', 'created_at', 'updated_at')
        read_only_fields = ('id', 'host_name', 'country_code', 'created_at', 'updated_at')
    
    def get_country_code(self, obj):
        """Return phone country code for the event's country"""
        return get_country_code(obj.country or 'IN')


class EventCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ('slug', 'title', 'event_type', 'date', 'city', 'country', 'is_public', 'has_rsvp', 'has_registry')
        read_only_fields = ('id',)
    
    def validate_slug(self, value):
        """Ensure slug is unique"""
        if Event.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This slug is already taken.")
        return value
    
    def to_representation(self, instance):
        """Return full event data including id after creation"""
        return EventSerializer(instance).data


class RSVPSerializer(serializers.ModelSerializer):
    guest_id = serializers.IntegerField(source='guest.id', read_only=True, allow_null=True)
    is_core_guest = serializers.SerializerMethodField()
    
    class Meta:
        model = RSVP
        fields = ('id', 'event', 'name', 'phone', 'email', 'will_attend', 'guests_count', 'notes', 'source_channel', 'guest_id', 'is_core_guest', 'created_at')
        read_only_fields = ('id', 'created_at')
    
    def get_is_core_guest(self, obj):
        """Check if this RSVP is from a guest in the guest list"""
        return obj.guest is not None


class RSVPCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=20)  # Format: +91XXXXXXXXXX or just digits
    country_code = serializers.CharField(required=False, allow_blank=True)  # Optional, defaults to event country
    email = serializers.EmailField(required=False, allow_blank=True)
    will_attend = serializers.ChoiceField(choices=RSVP.STATUS_CHOICES)
    guests_count = serializers.IntegerField(default=1, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)
    source_channel = serializers.ChoiceField(choices=[('qr', 'QR Code'), ('link', 'Web Link'), ('manual', 'Manual')], default='link', required=False)


class GuestSerializer(serializers.ModelSerializer):
    rsvp_status = serializers.SerializerMethodField()
    rsvp_will_attend = serializers.SerializerMethodField()
    country_code = serializers.SerializerMethodField()
    local_number = serializers.SerializerMethodField()
    
    class Meta:
        model = Guest
        fields = ('id', 'event', 'name', 'phone', 'country_code', 'country_iso', 'local_number', 'email', 'relationship', 'notes', 'rsvp_status', 'rsvp_will_attend', 'created_at')
        read_only_fields = ('id', 'created_at', 'rsvp_status', 'rsvp_will_attend', 'country_code', 'local_number')
    
    def get_rsvp_status(self, obj):
        """Check if this guest has RSVP'd by matching phone number (with country code)"""
        # First check if there's an RSVP linked via the guest foreign key (most direct)
        rsvp = RSVP.objects.filter(event=obj.event, guest=obj).first()
        if rsvp:
            return rsvp.will_attend  # 'yes', 'no', or 'maybe'
        
        # If no direct link, match by phone number (handles cases where guest wasn't linked during RSVP creation)
        rsvp = RSVP.objects.filter(event=obj.event, phone=obj.phone).first()
        if rsvp:
            return rsvp.will_attend  # 'yes', 'no', or 'maybe'
        
        return None  # No RSVP yet
    
    def get_rsvp_will_attend(self, obj):
        """Get the RSVP will_attend value for display"""
        return self.get_rsvp_status(obj)
    
    def get_country_code(self, obj):
        """Extract country code from phone number"""
        if not obj.phone or not obj.phone.startswith('+'):
            return None
        phone_digits = obj.phone[1:]  # Remove +
        # Try to match known country codes (longest first)
        from .country_codes import COUNTRY_CODES
        sorted_codes = sorted(set(COUNTRY_CODES.values()), key=lambda x: len(x.replace('+', '')), reverse=True)
        for code in sorted_codes:
            code_digits = code.replace('+', '')
            if phone_digits.startswith(code_digits):
                return code
        return None
    
    def get_local_number(self, obj):
        """Extract local number from phone number"""
        if not obj.phone or not obj.phone.startswith('+'):
            return obj.phone
        phone_digits = obj.phone[1:]  # Remove +
        # Try to match known country codes (longest first)
        from .country_codes import COUNTRY_CODES
        sorted_codes = sorted(set(COUNTRY_CODES.values()), key=lambda x: len(x.replace('+', '')), reverse=True)
        for code in sorted_codes:
            code_digits = code.replace('+', '')
            if phone_digits.startswith(code_digits):
                return phone_digits[len(code_digits):]
        return phone_digits


class GuestCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=20)  # Required - format: +91XXXXXXXXXX or just digits
    country_code = serializers.CharField(required=False, allow_blank=True)  # Optional, defaults to event country
    country_iso = serializers.CharField(required=False, allow_blank=True, max_length=2)  # ISO country code for analytics
    email = serializers.EmailField(required=False, allow_blank=True)
    relationship = serializers.CharField(required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_phone(self, value):
        """Validate phone is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Phone number is required.")
        return value.strip()
    
    def validate(self, data):
        """Format phone with country code if provided"""
        phone = data.get('phone', '')
        country_code = data.get('country_code', '')
        
        # If phone doesn't start with +, format it with country code
        if phone and not phone.startswith('+'):
            if country_code:
                data['phone'] = format_phone_with_country_code(phone, country_code)
            # If no country code provided, it will be set in the view based on event country
        
        return data

