from rest_framework import serializers
from .models import Event, RSVP, Guest, InvitePage, SubEvent, GuestSubEventInvite
from apps.users.serializers import UserSerializer
from .utils import get_country_code, format_phone_with_country_code


class EventSerializer(serializers.ModelSerializer):
    # Only include minimal host info for privacy (name only, no email)
    host_name = serializers.CharField(source='host.name', read_only=True, allow_null=True)
    country_code = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Event
        fields = ('id', 'host_name', 'slug', 'title', 'event_type', 'date', 'event_end_date', 'city', 'country', 'country_code', 'is_public', 'has_rsvp', 'has_registry', 'event_structure', 'rsvp_mode', 'banner_image', 'description', 'additional_photos', 'page_config', 'expiry_date', 'whatsapp_message_template', 'is_expired', 'created_at', 'updated_at')
        read_only_fields = ('id', 'host_name', 'country_code', 'is_expired', 'created_at', 'updated_at')
    
    def get_country_code(self, obj):
        """Return phone country code for the event's country"""
        return get_country_code(obj.country or 'IN')


class InvitePageSerializer(serializers.ModelSerializer):
    """Full serializer for InvitePage - read/write"""
    event_slug = serializers.CharField(source='event.slug', read_only=True)
    allowed_sub_events = serializers.SerializerMethodField()
    guest_context = serializers.SerializerMethodField()
    event_structure = serializers.CharField(source='event.event_structure', read_only=True)
    rsvp_mode = serializers.CharField(source='event.rsvp_mode', read_only=True)
    
    class Meta:
        model = InvitePage
        fields = ('id', 'event', 'event_slug', 'slug', 'background_url', 'config', 'is_published', 'allowed_sub_events', 'guest_context', 'event_structure', 'rsvp_mode', 'created_at', 'updated_at')
        read_only_fields = ('id', 'event_slug', 'allowed_sub_events', 'guest_context', 'event_structure', 'rsvp_mode', 'created_at', 'updated_at')
    
    def get_allowed_sub_events(self, obj):
        """Get allowed sub-events - set by view based on guest token or public visibility"""
        # This will be set by the view using context
        return self.context.get('allowed_sub_events', [])
    
    def get_guest_context(self, obj):
        """Get guest context if guest token was provided"""
        # This will be set by the view using context
        return self.context.get('guest_context', None)
    
    def validate_config(self, value):
        """Validate config structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Config must be a dictionary")
        
        # Validate elements array if present
        if 'elements' in value:
            if not isinstance(value['elements'], list):
                raise serializers.ValidationError("Elements must be an array")
            for element in value['elements']:
                if not isinstance(element, dict):
                    raise serializers.ValidationError("Each element must be an object")
                if 'id' not in element or 'type' not in element:
                    raise serializers.ValidationError("Each element must have 'id' and 'type'")
        
        return value


class InvitePageCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating InvitePage"""
    
    class Meta:
        model = InvitePage
        fields = ('slug', 'background_url', 'config')
    
    def validate_config(self, value):
        """Validate config structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Config must be a dictionary")
        return value


class InvitePageUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating InvitePage"""
    
    class Meta:
        model = InvitePage
        fields = ('background_url', 'config', 'is_published')
    
    def validate_config(self, value):
        """Validate config structure"""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Config must be a dictionary")
        return value


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
    sub_event_id = serializers.IntegerField(source='sub_event.id', read_only=True, allow_null=True)
    sub_event_title = serializers.CharField(source='sub_event.title', read_only=True, allow_null=True)
    is_core_guest = serializers.SerializerMethodField()
    country_code = serializers.SerializerMethodField()
    local_number = serializers.SerializerMethodField()
    
    class Meta:
        model = RSVP
        fields = ('id', 'event', 'sub_event', 'sub_event_id', 'sub_event_title', 'name', 'phone', 'email', 'will_attend', 'guests_count', 'notes', 'source_channel', 'guest_id', 'is_core_guest', 'is_removed', 'country_code', 'local_number', 'created_at', 'updated_at')
        read_only_fields = ('id', 'sub_event_id', 'sub_event_title', 'created_at', 'updated_at', 'country_code', 'local_number')
    
    def get_is_core_guest(self, obj):
        """Check if this RSVP is from a guest in the guest list"""
        return obj.guest is not None
    
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


class RSVPCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=20)  # Format: +91XXXXXXXXXX or just digits
    country_code = serializers.CharField(required=False, allow_blank=True)  # Optional, defaults to event country
    email = serializers.EmailField(required=False, allow_blank=True)
    will_attend = serializers.ChoiceField(choices=RSVP.STATUS_CHOICES)
    guests_count = serializers.IntegerField(default=1, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)
    source_channel = serializers.ChoiceField(choices=[('qr', 'QR Code'), ('link', 'Web Link'), ('manual', 'Manual')], default='link', required=False)
    selectedSubEventIds = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        help_text="Array of sub-event IDs for PER_SUBEVENT mode (only for ENVELOPE events)"
    )


class GuestSerializer(serializers.ModelSerializer):
    rsvp_status = serializers.SerializerMethodField()
    rsvp_will_attend = serializers.SerializerMethodField()
    country_code = serializers.SerializerMethodField()
    local_number = serializers.SerializerMethodField()
    guest_token = serializers.CharField(read_only=True)
    sub_event_invites = serializers.SerializerMethodField()
    
    class Meta:
        model = Guest
        fields = ('id', 'event', 'name', 'phone', 'country_code', 'country_iso', 'local_number', 'email', 'relationship', 'notes', 'is_removed', 'rsvp_status', 'rsvp_will_attend', 'guest_token', 'sub_event_invites', 'created_at')
        read_only_fields = ('id', 'created_at', 'rsvp_status', 'rsvp_will_attend', 'country_code', 'local_number', 'guest_token', 'sub_event_invites')
    
    def get_sub_event_invites(self, obj):
        """Get list of sub-event IDs this guest is invited to"""
        return list(obj.sub_event_invites.values_list('sub_event_id', flat=True))
    
    def get_rsvp_status(self, obj):
        """Check if this guest has RSVP'd by matching phone number (with country code)"""
        # First check if there's an RSVP linked via the guest foreign key (most direct)
        rsvp = RSVP.objects.filter(event=obj.event, guest=obj, is_removed=False).first()
        if rsvp:
            return rsvp.will_attend  # 'yes', 'no', or 'maybe'
        
        # If no direct link, match by phone number (handles cases where guest wasn't linked during RSVP creation)
        rsvp = RSVP.objects.filter(event=obj.event, phone=obj.phone, is_removed=False).first()
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


class SubEventSerializer(serializers.ModelSerializer):
    """Serializer for SubEvent - full CRUD"""
    
    class Meta:
        model = SubEvent
        fields = ('id', 'event', 'title', 'start_at', 'end_at', 'location', 'description', 'image_url', 'rsvp_enabled', 'is_public_visible', 'is_removed', 'created_at', 'updated_at')
        read_only_fields = ('id', 'event', 'created_at', 'updated_at')
    
    def validate(self, data):
        """Validate that end_at is after start_at if both are provided"""
        start_at = data.get('start_at')
        end_at = data.get('end_at')
        
        if start_at and end_at and end_at <= start_at:
            raise serializers.ValidationError("end_at must be after start_at")
        
        return data


class SubEventCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating SubEvent"""
    
    class Meta:
        model = SubEvent
        fields = ('title', 'start_at', 'end_at', 'location', 'description', 'image_url', 'rsvp_enabled', 'is_public_visible')
    
    def validate(self, data):
        """Validate that end_at is after start_at if both are provided"""
        start_at = data.get('start_at')
        end_at = data.get('end_at')
        
        if start_at and end_at and end_at <= start_at:
            raise serializers.ValidationError("end_at must be after start_at")
        
        return data


class GuestSubEventInviteSerializer(serializers.ModelSerializer):
    """Serializer for GuestSubEventInvite"""
    sub_event_title = serializers.CharField(source='sub_event.title', read_only=True)
    guest_name = serializers.CharField(source='guest.name', read_only=True)
    
    class Meta:
        model = GuestSubEventInvite
        fields = ('id', 'guest', 'guest_name', 'sub_event', 'sub_event_title', 'created_at')
        read_only_fields = ('id', 'guest_name', 'sub_event_title', 'created_at')

