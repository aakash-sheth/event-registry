from rest_framework import serializers
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify
from .models import Event, RSVP, Guest, InvitePage, SubEvent, GuestSubEventInvite, MessageTemplate, AttributionLink, InvitePageLayout, GreetingCardSample, MessageCampaign, CampaignRecipient, BookingSchedule, BookingSlot, SlotBooking
from apps.users.serializers import UserSerializer
from .utils import get_country_code, format_phone_with_country_code, normalize_csv_header, normalize_phone_for_match, phones_loosely_match
import re
import secrets
import string
from urllib.parse import urlencode


EVENT_RSVP_MUTATION_KEYS = frozenset({'rsvp_experience_mode', 'event_structure', 'rsvp_mode'})


def _display_label_for_booking_slot(slot, event) -> str:
    """Host list: use slot label, or a compact local time range if the label is empty."""
    text = (slot.label or '').strip()
    if text:
        return text
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo(event.timezone or 'UTC')
        start = slot.start_at.astimezone(tz)
        end = slot.end_at.astimezone(tz)
        return f"{start.strftime('%H:%M')}–{end.strftime('%H:%M')}"
    except Exception:
        return 'Booked'


class EventSerializer(serializers.ModelSerializer):
    # Only include minimal host info for privacy (name only, no email)
    host_name = serializers.CharField(source='host.name', read_only=True, allow_null=True)
    country_code = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)
    rsvp_experience_mode = serializers.ChoiceField(
        choices=Event.RSVP_EXPERIENCE_MODE_CHOICES,
        required=False,
    )
    rsvp_mode_readiness = serializers.SerializerMethodField()
    mode_switch_locked = serializers.SerializerMethodField()
    mode_switch_lock_reasons = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ('id', 'host_name', 'slug', 'title', 'event_type', 'date', 'event_end_date', 'city', 'country', 'timezone', 'country_code', 'is_public', 'has_rsvp', 'has_registry', 'event_structure', 'rsvp_mode', 'rsvp_experience_mode', 'rsvp_mode_readiness', 'mode_switch_locked', 'mode_switch_lock_reasons', 'banner_image', 'description', 'additional_photos', 'page_config', 'expiry_date', 'whatsapp_message_template', 'custom_fields_metadata', 'analytics_insights_enabled', 'analytics_enabled_at', 'analytics_enabled_by', 'is_expired', 'created_at', 'updated_at')
        read_only_fields = ('id', 'host_name', 'country_code', 'analytics_insights_enabled', 'analytics_enabled_at', 'analytics_enabled_by', 'is_expired', 'rsvp_mode_readiness', 'mode_switch_locked', 'mode_switch_lock_reasons', 'created_at', 'updated_at')
    
    def validate_slug(self, value):
        """Ensure slug is unique (excluding current instance on update)"""
        # Normalize to lowercase (matching model's save behavior)
        value = value.lower() if value else value
        
        # Get the current instance if updating
        instance = self.instance
        
        # Check if slug is already taken by another event
        queryset = Event.objects.filter(slug=value)
        if instance:
            # Exclude current instance when updating
            queryset = queryset.exclude(pk=instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError("This slug is already taken.")
        
        return value
    
    def get_country_code(self, obj):
        """Return phone country code for the event's country"""
        return get_country_code(obj.country or 'IN')

    def get_rsvp_mode_readiness(self, obj):
        return obj.get_rsvp_mode_readiness()

    def _mode_switch_lock_payload(self, obj):
        cache = getattr(self, '_mode_switch_lock_payload_cache', None)
        if cache is None or cache[0] != obj.pk:
            info = obj.get_mode_switch_lock_info()
            self._mode_switch_lock_payload_cache = (obj.pk, info)
        return self._mode_switch_lock_payload_cache[1]

    def get_mode_switch_locked(self, obj):
        return self._mode_switch_lock_payload(obj)['locked']

    def get_mode_switch_lock_reasons(self, obj):
        return self._mode_switch_lock_payload(obj)['reasons']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['rsvp_experience_mode'] = instance.get_canonical_rsvp_mode()
        return data

    def validate(self, attrs):
        attrs = super().validate(attrs)
        instance = self.instance

        # Non-RSVP PATCHes (e.g. has_rsvp, title) must not re-derive legacy RSVP fields.
        if instance and not (EVENT_RSVP_MUTATION_KEYS & attrs.keys()):
            return attrs

        # Ensure we always reason with canonical mode.
        incoming_mode = attrs.get('rsvp_experience_mode')
        if incoming_mode is None and instance:
            incoming_mode = instance.get_canonical_rsvp_mode()
        elif incoming_mode is None:
            incoming_mode = Event.RSVP_EXPERIENCE_MODE_STANDARD

        if incoming_mode not in {
            Event.RSVP_EXPERIENCE_MODE_STANDARD,
            Event.RSVP_EXPERIENCE_MODE_SUB_EVENT,
            Event.RSVP_EXPERIENCE_MODE_SLOT_BASED,
        }:
            raise serializers.ValidationError({'rsvp_experience_mode': 'Invalid RSVP mode.'})

        # Mode switch guardrail: prevent switching if live responses/bookings exist.
        if instance:
            current_mode = instance.get_canonical_rsvp_mode()
            if incoming_mode != current_mode:
                lock = instance.get_mode_switch_lock_info()
                if lock['locked']:
                    raise serializers.ValidationError({
                        'rsvp_experience_mode': (
                            'Cannot switch RSVP mode after receiving responses or slot bookings.'
                        )
                    })

        attrs['rsvp_experience_mode'] = incoming_mode

        # Canonical-to-legacy mapping to avoid mixed-mode behavior.
        if incoming_mode == Event.RSVP_EXPERIENCE_MODE_STANDARD:
            attrs['event_structure'] = 'SIMPLE'
            attrs['rsvp_mode'] = 'ONE_TAP_ALL'
        elif incoming_mode == Event.RSVP_EXPERIENCE_MODE_SUB_EVENT:
            attrs['event_structure'] = 'ENVELOPE'
            attrs['rsvp_mode'] = attrs.get(
                'rsvp_mode',
                instance.rsvp_mode if instance else 'PER_SUBEVENT'
            )
            if attrs['rsvp_mode'] not in {'PER_SUBEVENT', 'ONE_TAP_ALL'}:
                attrs['rsvp_mode'] = 'PER_SUBEVENT'
        else:  # slot_based
            attrs['event_structure'] = 'SIMPLE'
            attrs['rsvp_mode'] = 'ONE_TAP_ALL'

        return attrs


class InvitePageSerializer(serializers.ModelSerializer):
    """Full serializer for InvitePage - read/write"""
    event_slug = serializers.CharField(source='event.slug', read_only=True)
    event_country = serializers.CharField(source='event.country', read_only=True)
    event_timezone = serializers.CharField(source='event.timezone', read_only=True)
    allowed_sub_events = serializers.SerializerMethodField()
    guest_context = serializers.SerializerMethodField()
    event_structure = serializers.CharField(source='event.event_structure', read_only=True)
    rsvp_mode = serializers.CharField(source='event.rsvp_mode', read_only=True)
    rsvp_experience_mode = serializers.SerializerMethodField()
    has_rsvp = serializers.BooleanField(source='event.has_rsvp', read_only=True)
    has_registry = serializers.BooleanField(source='event.has_registry', read_only=True)
    show_branding = serializers.BooleanField(source='event.show_branding', read_only=True)
    state = serializers.SerializerMethodField()  # Expose state property using method field
    rsvp_count = serializers.SerializerMethodField()

    class Meta:
        model = InvitePage
        fields = ('id', 'event', 'event_slug', 'event_country', 'event_timezone', 'slug', 'background_url', 'config', 'is_published', 'state', 'allowed_sub_events', 'guest_context', 'event_structure', 'rsvp_mode', 'rsvp_experience_mode', 'has_rsvp', 'has_registry', 'show_branding', 'rsvp_count', 'created_at', 'updated_at')
        read_only_fields = ('id', 'event_slug', 'event_country', 'event_timezone', 'state', 'allowed_sub_events', 'guest_context', 'event_structure', 'rsvp_mode', 'rsvp_experience_mode', 'has_rsvp', 'has_registry', 'show_branding', 'rsvp_count', 'created_at', 'updated_at')
    
    def get_allowed_sub_events(self, obj):
        """Get allowed sub-events - set by view based on guest token or public visibility"""
        # This will be set by the view using context
        return self.context.get('allowed_sub_events', [])
    
    def get_guest_context(self, obj):
        """Get guest context if guest token was provided"""
        # This will be set by the view using context
        return self.context.get('guest_context', None)
    
    def get_state(self, obj):
        """Get the state property from the InvitePage model"""
        return obj.state

    def get_rsvp_experience_mode(self, obj):
        return obj.event.get_canonical_rsvp_mode()

    def get_rsvp_count(self, obj):
        """Count of confirmed (will_attend=yes) RSVPs for the event"""
        return obj.event.rsvps.filter(will_attend='yes', is_removed=False).count()

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
    slug = serializers.SlugField(required=False, allow_blank=True, max_length=100)

    class Meta:
        model = Event
        fields = ('slug', 'title', 'event_type', 'date', 'city', 'country', 'timezone', 'is_public', 'has_rsvp', 'has_registry', 'rsvp_experience_mode')
        read_only_fields = ('id',)

    @staticmethod
    def _generate_unique_slug(base: str) -> str:
        """Slugify base and append a numeric suffix until unique."""
        candidate = slugify(base)[:90] or 'event'
        if not Event.objects.filter(slug=candidate).exists():
            return candidate
        counter = 2
        while Event.objects.filter(slug=f"{candidate}-{counter}").exists():
            counter += 1
        return f"{candidate}-{counter}"

    def validate(self, attrs):
        attrs = super().validate(attrs)
        slug = attrs.get('slug', '').strip()
        mode = attrs.get('rsvp_experience_mode', Event.RSVP_EXPERIENCE_MODE_STANDARD)

        if mode not in {
            Event.RSVP_EXPERIENCE_MODE_STANDARD,
            Event.RSVP_EXPERIENCE_MODE_SUB_EVENT,
            Event.RSVP_EXPERIENCE_MODE_SLOT_BASED,
        }:
            raise serializers.ValidationError({'rsvp_experience_mode': 'Invalid RSVP mode.'})
        attrs['rsvp_experience_mode'] = mode

        if mode == Event.RSVP_EXPERIENCE_MODE_SUB_EVENT:
            attrs['event_structure'] = 'ENVELOPE'
            attrs['rsvp_mode'] = 'PER_SUBEVENT'
        else:
            attrs['event_structure'] = 'SIMPLE'
            attrs['rsvp_mode'] = 'ONE_TAP_ALL'

        if not slug:
            attrs['slug'] = self._generate_unique_slug(attrs.get('title', 'event'))
        else:
            attrs['slug'] = slug.lower()
            if Event.objects.filter(slug=attrs['slug']).exists():
                raise serializers.ValidationError({'slug': 'This slug is already taken.'})
        return attrs

    def to_representation(self, instance):
        """Return full event data including id after creation"""
        return EventSerializer(instance).data


class AttributionLinkSerializer(serializers.ModelSerializer):
    guest_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    short_url = serializers.SerializerMethodField()
    destination_url = serializers.SerializerMethodField()

    class Meta:
        model = AttributionLink
        fields = (
            'id', 'token', 'event', 'guest', 'guest_id',
            'target_type', 'channel', 'campaign', 'placement',
            'is_active', 'expires_at', 'click_count', 'metadata',
            'short_url', 'destination_url', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'token', 'event', 'guest', 'click_count', 'created_at', 'updated_at')

    def validate(self, attrs):
        event = self.context.get('event')
        if not event:
            raise serializers.ValidationError("Event context is required.")
        if not getattr(settings, 'ENABLE_ATTRIBUTION_LINKS', True):
            raise serializers.ValidationError('Attribution links are currently disabled.')

        target_type = attrs.get('target_type') or getattr(self.instance, 'target_type', None)
        if target_type == 'registry' and not getattr(settings, 'ENABLE_REGISTRY_ATTRIBUTION_LINKS', True):
            raise serializers.ValidationError({'target_type': 'Registry attribution links are not enabled yet.'})
        if target_type == 'registry' and not event.has_registry:
            raise serializers.ValidationError({'target_type': 'Registry link is not allowed because registry is disabled for this event.'})
        if target_type == 'rsvp' and not event.has_rsvp:
            raise serializers.ValidationError({'target_type': 'RSVP link is not allowed because RSVP is disabled for this event.'})

        guest_id = attrs.pop('guest_id', None)
        if guest_id:
            try:
                guest = Guest.objects.get(id=guest_id, event=event, is_removed=False)
            except Guest.DoesNotExist:
                raise serializers.ValidationError({'guest_id': 'Guest not found for this event.'})
            attrs['guest'] = guest
        elif self.instance and self.instance.guest_id:
            attrs['guest'] = self.instance.guest
        else:
            attrs['guest'] = None

        return attrs

    def create(self, validated_data):
        event = self.context['event']
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else None

        target_type = validated_data['target_type']
        existing = AttributionLink.objects.filter(
            event=event,
            target_type=target_type,
            is_active=True,
        ).order_by('-created_at').first()
        if existing:
            # Keep a canonical single active link per destination.
            fields_to_update = []
            for field in ('channel', 'campaign', 'placement', 'metadata', 'expires_at'):
                incoming = validated_data.get(field, getattr(existing, field))
                if getattr(existing, field) != incoming:
                    setattr(existing, field, incoming)
                    fields_to_update.append(field)
            if existing.created_by_id is None and user:
                existing.created_by = user
                fields_to_update.append('created_by')
            if fields_to_update:
                existing.save(update_fields=fields_to_update + ['updated_at'])
            return existing

        # Generate collision-resistant base62 token.
        alphabet = string.ascii_letters + string.digits
        token = ''
        for _ in range(8):
            candidate = ''.join(secrets.choice(alphabet) for _ in range(8))
            if not AttributionLink.objects.filter(token=candidate).exists():
                token = candidate
                break
        if not token:
            raise serializers.ValidationError('Unable to generate a unique token. Please retry.')

        return AttributionLink.objects.create(
            event=event,
            created_by=user,
            token=token,
            **validated_data,
        )

    def _build_destination_path(self, obj):
        base_path = {
            'invite': f"/invite/{obj.event.slug}",
            'rsvp': f"/event/{obj.event.slug}/rsvp",
            'registry': f"/registry/{obj.event.slug}",
        }.get(obj.target_type, f"/invite/{obj.event.slug}")

        params = {'source': obj.channel or 'link', 'al': obj.token}
        if obj.guest_id and obj.guest and obj.guest.guest_token:
            params['g'] = obj.guest.guest_token
        if obj.campaign:
            params['campaign'] = obj.campaign
        if obj.placement:
            params['placement'] = obj.placement

        return f"{base_path}?{urlencode(params)}"

    def get_short_url(self, obj):
        short_path = f"/q/{obj.token}/"
        origin = getattr(settings, 'FRONTEND_ORIGIN', '').rstrip('/')
        if origin:
            return f"{origin}{short_path}"
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(short_path)
        return short_path

    def get_destination_url(self, obj):
        request = self.context.get('request')
        destination_path = self._build_destination_path(obj)
        if not request:
            return destination_path
        return request.build_absolute_uri(destination_path)


class RSVPSerializer(serializers.ModelSerializer):
    guest_id = serializers.IntegerField(source='guest.id', read_only=True, allow_null=True)
    sub_event_id = serializers.IntegerField(source='sub_event.id', read_only=True, allow_null=True)
    sub_event_title = serializers.CharField(source='sub_event.title', read_only=True, allow_null=True)
    is_core_guest = serializers.SerializerMethodField()
    country_code = serializers.SerializerMethodField()
    local_number = serializers.SerializerMethodField()
    
    class Meta:
        model = RSVP
        fields = ('id', 'event', 'sub_event', 'sub_event_id', 'sub_event_title', 'name', 'phone', 'email', 'will_attend', 'guests_count', 'notes', 'custom_fields', 'source_channel', 'guest_id', 'is_core_guest', 'is_removed', 'country_code', 'local_number', 'created_at', 'updated_at')
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
    custom_fields = serializers.DictField(required=False)
    source_channel = serializers.ChoiceField(choices=[('qr', 'QR Code'), ('link', 'Web Link'), ('manual', 'Manual')], default='link', required=False)
    selectedSubEventIds = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        help_text="Array of sub-event IDs for PER_SUBEVENT mode (only for ENVELOPE events)"
    )

    def validate_custom_fields(self, value):
        """
        Validate and normalize RSVP custom fields (keys must be normalized-like, values bounded).
        We do not enforce membership in event.custom_fields_metadata here because this serializer
        doesn't have event context; UI enforces membership.
        """
        if value is None:
            return None
        if not isinstance(value, dict):
            raise serializers.ValidationError("custom_fields must be an object")

        KEY_RE = re.compile(r'^[a-z0-9_]{1,50}$')
        MAX_KEYS = 50
        MAX_VALUE_LEN = 500

        if len(value) > MAX_KEYS:
            raise serializers.ValidationError(f"Too many custom fields (max {MAX_KEYS})")

        normalized = {}
        for raw_key, raw_val in value.items():
            key = str(raw_key or '').strip()
            if not key:
                continue
            if not KEY_RE.match(key):
                raise serializers.ValidationError(f"Invalid custom field key: {key}")

            # Allow booleans/numbers, store as string for consistency where needed
            if isinstance(raw_val, bool):
                val = raw_val
            elif isinstance(raw_val, (int, float)):
                val = raw_val
            else:
                val = '' if raw_val is None else str(raw_val).strip()
                if len(val) > MAX_VALUE_LEN:
                    raise serializers.ValidationError(f"Custom field '{key}' value too long (max {MAX_VALUE_LEN})")

            normalized[key] = val

        return normalized


class GuestSerializer(serializers.ModelSerializer):
    rsvp_status = serializers.SerializerMethodField()
    rsvp_will_attend = serializers.SerializerMethodField()
    rsvp_guests_count = serializers.SerializerMethodField()
    slot_booking_selected_slot_label = serializers.SerializerMethodField()
    slot_booking_slot_date = serializers.SerializerMethodField()
    slot_booking_status = serializers.SerializerMethodField()
    rsvp_notes = serializers.SerializerMethodField()
    country_code = serializers.SerializerMethodField()
    local_number = serializers.SerializerMethodField()
    guest_token = serializers.CharField(read_only=True)
    sub_event_invites = serializers.SerializerMethodField()
    
    class Meta:
        model = Guest
        fields = (
            'id',
            'event',
            'name',
            'phone',
            'country_code',
            'country_iso',
            'local_number',
            'email',
            'relationship',
            'notes',
            'is_removed',
            'source',
            'rsvp_status',
            'rsvp_will_attend',
            'rsvp_guests_count',
            'slot_booking_selected_slot_label',
            'slot_booking_slot_date',
            'slot_booking_status',
            'rsvp_notes',
            'guest_token',
            'sub_event_invites',
            'custom_fields',
            'invitation_sent',
            'invitation_sent_at',
            'created_at',
        )
        read_only_fields = (
            'id',
            'created_at',
            'rsvp_status',
            'rsvp_will_attend',
            'rsvp_guests_count',
            'country_code',
            'local_number',
            'guest_token',
            'sub_event_invites',
            'source',
            'slot_booking_selected_slot_label',
            'slot_booking_slot_date',
            'slot_booking_status',
            'rsvp_notes',
        )

    def validate_custom_fields(self, value):
        """
        Validate and normalize guest custom fields.
        - Keys normalized with normalize_csv_header
        - Enforce max keys and value lengths to prevent abuse/bloat
        - Return a normalized dict
        """
        if value is None:
            return None
        if not isinstance(value, dict):
            raise serializers.ValidationError("custom_fields must be an object")

        KEY_RE = re.compile(r'^[a-z0-9_]{1,50}$')
        MAX_KEYS = 50
        MAX_VALUE_LEN = 500
        reserved = {'name', 'phone', 'email', 'relationship', 'notes', 'country_code', 'country_iso'}

        if len(value) > MAX_KEYS:
            raise serializers.ValidationError(f"Too many custom fields (max {MAX_KEYS})")

        normalized = {}
        for raw_key, raw_val in value.items():
            key = normalize_csv_header(str(raw_key or ''))
            if not key:
                continue
            if key in reserved:
                raise serializers.ValidationError(f"Invalid custom field key (reserved): {key}")
            if not KEY_RE.match(key):
                raise serializers.ValidationError(f"Invalid custom field key: {key}")

            val = '' if raw_val is None else str(raw_val)
            val = val.strip()
            if len(val) > MAX_VALUE_LEN:
                raise serializers.ValidationError(f"Custom field '{key}' value too long (max {MAX_VALUE_LEN})")
            normalized[key] = val

        return normalized

    def update(self, instance, validated_data):
        """
        Merge custom_fields instead of overwriting:
        - Provided keys with non-empty values are set
        - Provided keys with empty values remove the key
        """
        incoming_custom_fields = validated_data.pop('custom_fields', None)

        # Regular field updates
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if incoming_custom_fields is not None:
            current = instance.custom_fields if isinstance(instance.custom_fields, dict) else {}
            for k, v in incoming_custom_fields.items():
                if v:
                    current[k] = v
                else:
                    current.pop(k, None)
            instance.custom_fields = current

        instance.save()
        return instance
    
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

        if obj.phone and normalize_phone_for_match(obj.phone):
            for r in RSVP.objects.filter(event=obj.event, is_removed=False).order_by('-created_at'):
                if phones_loosely_match(r.phone, obj.phone):
                    return r.will_attend

        return None  # No RSVP yet
    
    def get_rsvp_will_attend(self, obj):
        """Get the RSVP will_attend value for display"""
        return self.get_rsvp_status(obj)
    
    def get_rsvp_guests_count(self, obj):
        """Get the guests_count from the associated RSVP"""
        # First check if there's an RSVP linked via the guest foreign key (most direct)
        rsvp = RSVP.objects.filter(event=obj.event, guest=obj, is_removed=False).first()
        if rsvp:
            return rsvp.guests_count
        
        # If no direct link, match by phone number (handles cases where guest wasn't linked during RSVP creation)
        rsvp = RSVP.objects.filter(event=obj.event, phone=obj.phone, is_removed=False).first()
        if rsvp:
            return rsvp.guests_count

        if obj.phone and normalize_phone_for_match(obj.phone):
            for r in RSVP.objects.filter(event=obj.event, is_removed=False).order_by('-created_at'):
                if phones_loosely_match(r.phone, obj.phone):
                    return r.guests_count

        return None  # No RSVP yet

    def _get_confirmed_slot_booking(self, obj):
        """
        Return the latest confirmed SlotBooking for this guest+event.
        Prefer joining on guest FK, but fall back to phone_snapshot when the RSVP/booking
        was created without linking the guest FK.
        """
        slot_booking = (
            SlotBooking.objects.filter(
                event=obj.event,
                guest=obj,
                status=SlotBooking.STATUS_CONFIRMED,
            )
            .select_related('slot')
            .order_by('-created_at')
            .first()
        )
        if slot_booking:
            return slot_booking

        if not obj.phone:
            return None

        exact = (
            SlotBooking.objects.filter(
                event=obj.event,
                phone_snapshot=obj.phone,
                status=SlotBooking.STATUS_CONFIRMED,
            )
            .select_related('slot')
            .order_by('-created_at')
            .first()
        )
        if exact:
            return exact

        if not normalize_phone_for_match(obj.phone):
            return None

        qs = (
            SlotBooking.objects.filter(
                event=obj.event,
                status=SlotBooking.STATUS_CONFIRMED,
            )
            .select_related('slot')
            .order_by('-created_at')
        )
        for sb in qs:
            if phones_loosely_match(obj.phone, sb.phone_snapshot):
                return sb
        return None

    def get_slot_booking_selected_slot_label(self, obj):
        slot_booking = self._get_confirmed_slot_booking(obj)
        if not slot_booking or not slot_booking.slot:
            return None
        return _display_label_for_booking_slot(slot_booking.slot, obj.event)

    def get_slot_booking_slot_date(self, obj):
        slot_booking = self._get_confirmed_slot_booking(obj)
        if not slot_booking or not slot_booking.slot:
            return None
        return str(slot_booking.slot.slot_date)

    def get_slot_booking_status(self, obj):
        slot_booking = self._get_confirmed_slot_booking(obj)
        if not slot_booking:
            return None
        return 'confirmed'

    def get_rsvp_notes(self, obj):
        """Notes from the linked RSVP (slot / public flows store notes here, not on Guest)."""
        rsvp = RSVP.objects.filter(event=obj.event, guest=obj, is_removed=False).first()
        if not rsvp and obj.phone:
            rsvp = RSVP.objects.filter(event=obj.event, phone=obj.phone, is_removed=False).first()
        if not rsvp and obj.phone:
            if normalize_phone_for_match(obj.phone):
                for r in RSVP.objects.filter(event=obj.event, is_removed=False).order_by('-created_at'):
                    if phones_loosely_match(r.phone, obj.phone):
                        rsvp = r
                        break
        if not rsvp:
            return None
        text = (rsvp.notes or '').strip()
        return text or None

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
    custom_fields = serializers.DictField(required=False)
    
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
        fields = ('id', 'event', 'title', 'start_at', 'end_at', 'location', 'description', 'image_url', 'background_color', 'rsvp_enabled', 'is_public_visible', 'is_removed', 'created_at', 'updated_at')
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
        fields = ('title', 'start_at', 'end_at', 'location', 'description', 'image_url', 'background_color', 'rsvp_enabled', 'is_public_visible')
    
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


class BookingScheduleSerializer(serializers.ModelSerializer):
    def create(self, validated_data):
        validated_data.setdefault('status_changed_at', timezone.now())
        return super().create(validated_data)

    def update(self, instance, validated_data):
        previous_enabled = instance.is_enabled
        next_enabled = validated_data.get('is_enabled', previous_enabled)
        if next_enabled != previous_enabled:
            validated_data['status_changed_at'] = timezone.now()
        return super().update(instance, validated_data)

    class Meta:
        model = BookingSchedule
        fields = (
            'id', 'event', 'is_enabled', 'seat_visibility_mode', 'allow_direct_bookings',
            'allow_host_capacity_override', 'booking_open_days_before',
            'booking_close_hours_before', 'timezone', 'status_changed_at', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'event', 'status_changed_at', 'created_at', 'updated_at')


class BookingSlotSerializer(serializers.ModelSerializer):
    remaining_seats = serializers.SerializerMethodField()

    class Meta:
        model = BookingSlot
        fields = (
            'id', 'event', 'schedule', 'slot_date', 'start_at', 'end_at', 'label',
            'display_order', 'capacity_total', 'status', 'metadata_json',
            'remaining_seats', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'event', 'schedule', 'remaining_seats', 'created_at', 'updated_at')

    def validate(self, data):
        start_at = data.get('start_at', getattr(self.instance, 'start_at', None))
        end_at = data.get('end_at', getattr(self.instance, 'end_at', None))
        if start_at and end_at and end_at <= start_at:
            raise serializers.ValidationError("end_at must be after start_at")
        return data

    def get_remaining_seats(self, obj):
        confirmed_sum = obj.bookings.filter(status=SlotBooking.STATUS_CONFIRMED).aggregate(
            total=models.Sum('seats_booked')
        )['total'] or 0
        return max(0, obj.capacity_total - confirmed_sum)


class SlotBookingSerializer(serializers.ModelSerializer):
    slot = BookingSlotSerializer(read_only=True)
    slot_id = serializers.IntegerField(write_only=True, required=False)
    guest_name = serializers.CharField(source='guest.name', read_only=True, allow_null=True)

    class Meta:
        model = SlotBooking
        fields = (
            'id', 'event', 'slot', 'slot_id', 'guest', 'guest_name', 'phone_snapshot',
            'name_snapshot', 'email_snapshot', 'seats_booked', 'source', 'status',
            'idempotency_key', 'booked_at', 'cancelled_at', 'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'event', 'guest', 'guest_name', 'booked_at', 'created_at', 'updated_at')


class MessageTemplateSerializer(serializers.ModelSerializer):
    """Serializer for MessageTemplate"""
    preview = serializers.SerializerMethodField()
    available_variables = serializers.SerializerMethodField()
    
    class Meta:
        model = MessageTemplate
        fields = ('id', 'event', 'name', 'message_type', 'template_text', 'description', 'usage_count', 'is_active', 'last_used_at', 'is_default', 'is_system_default', 'created_by', 'created_at', 'updated_at', 'preview', 'available_variables')
        read_only_fields = ('id', 'usage_count', 'last_used_at', 'created_at', 'updated_at', 'is_system_default', 'created_by', 'available_variables')
    
    def get_preview(self, obj):
        """Generate preview with sample data"""
        return obj.get_preview()
    
    def get_available_variables(self, obj):
        """Get list of available variables for this event (default + custom from CSV)"""
        variables = []
        
        # Default variables
        default_vars = [
            {'key': '[name]', 'label': 'Guest Name', 'description': 'Name of the guest', 'example': 'Sarah'},
            {'key': '[event_title]', 'label': 'Event Title', 'description': 'Title of the event', 'example': obj.event.title},
            {'key': '[event_date]', 'label': 'Event Date', 'description': 'Date of the event', 'example': obj.event.date.strftime('%B %d, %Y') if obj.event.date else 'TBD'},
            {'key': '[event_url]', 'label': 'Event URL', 'description': 'Link to the event invitation', 'example': f'https://example.com/invite/{obj.event.slug}'},
            {'key': '[host_name]', 'label': 'Host Name', 'description': 'Name of the event host', 'example': obj.event.host.name or 'Host'},
            {'key': '[event_location]', 'label': 'Event Location', 'description': 'Location of the event', 'example': obj.event.city or 'Location TBD'},
            {'key': '[map_direction]', 'label': 'Map Direction Link', 'description': 'Google Maps link to event location', 'example': 'https://maps.google.com/?q=Location'},
        ]
        variables.extend(default_vars)
        
        # Custom variables from CSV imports
        custom_metadata = obj.event.custom_fields_metadata or {}
        for normalized_key, metadata in custom_metadata.items():
            if isinstance(metadata, dict):
                display_label = metadata.get('display_label', normalized_key)
                example = metadata.get('example', '—')
            else:
                # Backward compatibility: if metadata is just a string (old format)
                display_label = metadata
                example = '—'
            
            variables.append({
                'key': f'[{normalized_key}]',
                'label': display_label,
                'description': f'Custom field from CSV: {display_label}',
                'example': example,
                'is_custom': True,
            })
        
        return variables
    
    def validate(self, data):
        """Validate that only one default template per event"""
        instance = self.instance
        event = data.get('event') or (instance.event if instance else None)
        is_default = data.get('is_default', False)
        
        if is_default and event:
            # Check if another template is already default for this event
            existing_default = MessageTemplate.objects.filter(
                event=event,
                is_default=True
            ).exclude(id=instance.id if instance else None)
            
            if existing_default.exists():
                # Unset other defaults
                existing_default.update(is_default=False)
        
        return data
    
    def validate_template_text(self, value):
        """Validate template text is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Template text cannot be empty.")
        
        # Check for valid variables (optional - just warn, don't fail)
        valid_variables = ['[name]', '[event_title]', '[event_date]', '[event_url]', '[host_name]', '[event_location]', '[map_direction]']
        # We don't enforce variables, just allow any text
        
        # Check length (WhatsApp limit is 4096 characters)
        if len(value) > 4096:
            raise serializers.ValidationError("Template text cannot exceed 4096 characters (WhatsApp limit).")
        
        # Warn if extremely long (but allow)
        if len(value) > 3000:
            # We'll allow it but the frontend should show a warning
            pass
        
        return value
    
    def validate_name(self, value):
        """Validate name is not empty"""
        if not value or not value.strip():
            raise serializers.ValidationError("Template name cannot be empty.")
        return value.strip()


class InvitePageLayoutSerializer(serializers.ModelSerializer):
    """Serializer for InvitePageLayout (Page Layout Studio)."""
    created_by_name = serializers.CharField(source='created_by.name', read_only=True, allow_null=True)
    updated_by_name = serializers.CharField(source='updated_by.name', read_only=True, allow_null=True)
    # Override URLField with CharField so relative paths (e.g. /invite-templates/minimal.svg)
    # are accepted alongside absolute https:// URLs.
    thumbnail = serializers.CharField(max_length=2000, allow_blank=True, required=False)

    class Meta:
        model = InvitePageLayout
        fields = (
            'id', 'name', 'description', 'thumbnail', 'preview_alt', 'config',
            'visibility', 'status', 'created_by', 'created_by_name', 'updated_by', 'updated_by_name',
            'created_at', 'updated_at',
            'is_premium', 'price_cents', 'creator', 'creator_share_percent',
        )
        read_only_fields = ('id', 'created_by', 'created_by_name', 'updated_by', 'updated_by_name', 'created_at', 'updated_at')

    def validate_config(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("config must be a JSON object.")
        return value


class GreetingCardSampleSerializer(serializers.ModelSerializer):
    """Serializer for GreetingCardSample (staff-curated card backgrounds)."""
    created_by_name = serializers.CharField(source='created_by.name', read_only=True, allow_null=True)
    # Use CharField so relative /media/ paths from local dev are accepted alongside absolute https:// URLs.
    background_image_url = serializers.CharField(max_length=500)

    class Meta:
        model = GreetingCardSample
        fields = (
            'id', 'name', 'description', 'background_image_url', 'text_overlays',
            'tags', 'sort_order', 'is_active', 'created_by', 'created_by_name',
            'created_at', 'updated_at',
        )
        read_only_fields = ('id', 'created_by', 'created_by_name', 'created_at', 'updated_at')


# ---------------------------------------------------------------------------
# WhatsApp Campaign serializers
# ---------------------------------------------------------------------------

class CampaignRecipientSerializer(serializers.ModelSerializer):
    guest_name = serializers.CharField(source='guest.name', read_only=True, allow_null=True)

    class Meta:
        model = CampaignRecipient
        fields = (
            'id', 'campaign', 'guest', 'guest_name', 'phone',
            'resolved_message', 'status', 'whatsapp_message_id',
            'error_message', 'sent_at', 'delivered_at', 'read_at',
            'created_at', 'updated_at',
        )
        read_only_fields = fields


class MessageCampaignSerializer(serializers.ModelSerializer):
    recipient_summary = serializers.SerializerMethodField()

    class Meta:
        model = MessageCampaign
        fields = (
            'id', 'event', 'name', 'template', 'message_mode',
            'message_body', 'meta_template_name', 'meta_template_language',
            'guest_filter', 'filter_relationship', 'custom_guest_ids',
            'filter_slot_id', 'filter_slot_date', 'filter_booking_status',
            'scheduled_at', 'status',
            'total_recipients', 'sent_count', 'delivered_count',
            'read_count', 'failed_count',
            'started_at', 'completed_at',
            'created_by', 'created_at', 'updated_at',
            'recipient_summary',
        )
        read_only_fields = (
            'id', 'status', 'total_recipients', 'sent_count', 'delivered_count',
            'read_count', 'failed_count', 'started_at', 'completed_at',
            'created_by', 'created_at', 'updated_at', 'recipient_summary',
        )

    def get_recipient_summary(self, obj):
        return {
            'total': obj.total_recipients,
            'sent': obj.sent_count,
            'delivered': obj.delivered_count,
            'read': obj.read_count,
            'failed': obj.failed_count,
        }


class MessageCampaignCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageCampaign
        fields = (
            'name', 'template', 'message_mode', 'message_body',
            'meta_template_name', 'meta_template_language',
            'guest_filter', 'filter_relationship', 'custom_guest_ids',
            'filter_slot_id', 'filter_slot_date', 'filter_booking_status',
            'scheduled_at',
        )

    def validate_message_body(self, value):
        if len(value) > 1024:
            raise serializers.ValidationError(
                f'Message is too long ({len(value)} chars). Meta WhatsApp limit is 1024 characters.'
            )
        return value

    def validate_scheduled_at(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError('Scheduled time must be in the future.')
        return value

    def validate(self, attrs):
        if attrs.get('message_mode') == MessageCampaign.MSG_MODE_TEMPLATE:
            if not attrs.get('meta_template_name'):
                raise serializers.ValidationError(
                    {'meta_template_name': 'Required for approved_template mode.'}
                )
        if attrs.get('guest_filter') == MessageCampaign.FILTER_RELATIONSHIP:
            if not attrs.get('filter_relationship'):
                raise serializers.ValidationError(
                    {'filter_relationship': 'Required when filtering by relationship.'}
                )
        if attrs.get('guest_filter') == MessageCampaign.FILTER_CUSTOM:
            if not attrs.get('custom_guest_ids'):
                raise serializers.ValidationError(
                    {'custom_guest_ids': 'At least one guest ID required for custom selection.'}
                )
        if attrs.get('guest_filter') == MessageCampaign.FILTER_BOOKING_SLOT:
            if not attrs.get('filter_slot_id'):
                raise serializers.ValidationError(
                    {'filter_slot_id': 'Required when filtering by booking slot.'}
                )
        if attrs.get('guest_filter') == MessageCampaign.FILTER_BOOKING_DATE:
            if not attrs.get('filter_slot_date'):
                raise serializers.ValidationError(
                    {'filter_slot_date': 'Required when filtering by booking date.'}
                )
        if attrs.get('guest_filter') == MessageCampaign.FILTER_BOOKING_STATUS:
            if not attrs.get('filter_booking_status'):
                raise serializers.ValidationError(
                    {'filter_booking_status': 'Required when filtering by booking status.'}
                )
        return attrs

