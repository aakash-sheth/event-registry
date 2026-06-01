from decimal import Decimal

from django.db import models, IntegrityError
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import Q
from apps.users.models import User


class Event(models.Model):
    EVENT_TYPE_CHOICES = [
        # Life Events
        ('wedding', 'Wedding'),
        ('engagement', 'Engagement'),
        ('reception', 'Reception'),
        ('anniversary', 'Anniversary'),
        ('birthday', 'Birthday'),
        ('baby_shower', 'Baby Shower'),
        ('bridal_shower', 'Bridal Shower'),
        ('bachelor_party', 'Bachelor Party'),
        ('bachelorette_party', 'Bachelorette Party'),
        ('gender_reveal', 'Gender Reveal'),
        ('naming_ceremony', 'Naming Ceremony'),
        ('housewarming', 'Housewarming'),
        ('graduation', 'Graduation'),
        ('retirement', 'Retirement'),
        # Religious & Ceremonial
        ('religious_ceremony', 'Religious Ceremony'),
        ('puja', 'Puja'),
        ('satsang', 'Satsang'),
        ('church_service', 'Church Service'),
        ('bar_mitzvah', 'Bar Mitzvah'),
        ('bat_mitzvah', 'Bat Mitzvah'),
        ('communion', 'Communion'),
        ('confirmation', 'Confirmation'),
        # Professional & Business
        ('award_ceremony', 'Award Ceremony'),
        ('conference', 'Conference'),
        ('corporate_event', 'Corporate Event'),
        ('networking', 'Networking Event'),
        ('offsite', 'Offsite / Retreat'),
        ('product_launch', 'Product Launch'),
        ('seminar', 'Seminar'),
        ('team_building', 'Team Building'),
        ('town_hall', 'Town Hall'),
        ('trade_show', 'Trade Show / Expo'),
        ('training', 'Training / Onboarding'),
        ('workshop', 'Workshop'),
        # Social & Community
        ('fundraiser', 'Fundraiser'),
        ('charity_event', 'Charity Event'),
        ('community_event', 'Community Event'),
        ('festival', 'Festival'),
        ('cultural_event', 'Cultural Event'),
        ('exhibition', 'Exhibition'),
        ('art_show', 'Art Show'),
        # Entertainment
        ('concert', 'Concert'),
        ('music_event', 'Music Event'),
        ('theater', 'Theater'),
        ('comedy_show', 'Comedy Show'),
        ('sports_event', 'Sports Event'),
        # Food & Dining
        ('dinner_party', 'Dinner Party'),
        ('brunch', 'Brunch'),
        ('cocktail_party', 'Cocktail Party'),
        ('tea_party', 'Tea Party'),
        ('potluck', 'Potluck'),
        # Other
        ('other', 'Other'),
    ]
    
    EVENT_STRUCTURE_CHOICES = [
        ('SIMPLE', 'Simple'),
        ('ENVELOPE', 'Envelope'),
    ]
    
    RSVP_MODE_CHOICES = [
        ('PER_SUBEVENT', 'Per Sub-Event'),
        ('ONE_TAP_ALL', 'One Tap All'),
    ]

    RSVP_EXPERIENCE_MODE_STANDARD = 'standard'
    RSVP_EXPERIENCE_MODE_SUB_EVENT = 'sub_event'
    RSVP_EXPERIENCE_MODE_SLOT_BASED = 'slot_based'
    RSVP_EXPERIENCE_MODE_AUTO_CONFIRM = 'auto_confirm'
    RSVP_EXPERIENCE_MODE_CHOICES = [
        (RSVP_EXPERIENCE_MODE_STANDARD, 'Standard RSVP'),
        (RSVP_EXPERIENCE_MODE_SUB_EVENT, 'Sub-event RSVP'),
        (RSVP_EXPERIENCE_MODE_SLOT_BASED, 'Slot-based RSVP'),
        (RSVP_EXPERIENCE_MODE_AUTO_CONFIRM, 'Confirm attendance'),
    ]
    
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='events')
    slug = models.SlugField(unique=True, max_length=100)
    title = models.CharField(max_length=255)
    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES, default='wedding')
    date = models.DateField(null=True, blank=True)
    event_end_date = models.DateField(null=True, blank=True, help_text="End date for multi-day events (optional)")
    city = models.CharField(max_length=255, blank=True)
    country = models.CharField(max_length=2, default='IN', help_text="ISO 3166-1 alpha-2 country code (e.g., IN, US, UK)")
    timezone = models.CharField(
        max_length=64,
        default='Asia/Kolkata',
        help_text="IANA timezone name (e.g., Asia/Kolkata, America/New_York)"
    )
    is_public = models.BooleanField(default=True)
    
    # Event structure and RSVP mode
    event_structure = models.CharField(max_length=20, choices=EVENT_STRUCTURE_CHOICES, default='SIMPLE', help_text="SIMPLE: single event, ENVELOPE: event with sub-events")
    rsvp_mode = models.CharField(max_length=20, choices=RSVP_MODE_CHOICES, default='ONE_TAP_ALL', help_text="PER_SUBEVENT: RSVP per sub-event, ONE_TAP_ALL: single confirmation for all")
    rsvp_experience_mode = models.CharField(
        max_length=20,
        choices=RSVP_EXPERIENCE_MODE_CHOICES,
        default=RSVP_EXPERIENCE_MODE_STANDARD,
        help_text="Canonical RSVP mode used for host settings and guest rendering."
    )
    rsvp_total_capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Optional max attendance cap for registration-style RSVP (shown in host stats).",
    )
    rsvp_block_on_full_capacity = models.BooleanField(
        default=False,
        help_text="When enabled with a total capacity, block new yes/confirm RSVPs once full.",
    )
    rsvp_require_sub_event_selection = models.BooleanField(
        default=False,
        help_text="PER_SUBEVENT only: guests must select at least one session before submitting a Yes RSVP.",
    )
    
    # Cached sub-event counts for performance optimization
    public_sub_events_count = models.IntegerField(
        default=0,
        help_text="Cached count of public-visible, non-removed sub-events (auto-updated via signals)"
    )
    total_sub_events_count = models.IntegerField(
        default=0,
        help_text="Cached count of all non-removed sub-events (auto-updated via signals)"
    )
    
    # Feature toggles
    has_rsvp = models.BooleanField(default=True, help_text="Enable RSVP functionality for this event")
    has_registry = models.BooleanField(default=True, help_text="Enable Gift Registry functionality for this event")
    show_branding = models.BooleanField(default=True, help_text="Show 'Powered by EkFern' branding on public invite pages (disable for paid plans)")
    
    # Event page customization
    banner_image = models.TextField(blank=True, help_text="Banner image URL or data URL for public invitation page (deprecated - use page_config)")
    description = models.TextField(blank=True, help_text="Rich text description for public invitation page (deprecated - use page_config)")
    additional_photos = models.JSONField(default=list, blank=True, help_text="Array of up to 5 photo URLs or data URLs (deprecated - use page_config)")
    page_config = models.JSONField(default=dict, blank=True, help_text="Living Poster invitation page configuration with theme, hero, description")
    
    # Event expiry and messaging
    expiry_date = models.DateField(null=True, blank=True, help_text="Date when event expires (for impact calculation)")
    whatsapp_message_template = models.TextField(blank=True, help_text="Custom WhatsApp message template for sharing")

    # Attribution insights visibility gate (collection remains always-on)
    analytics_insights_enabled = models.BooleanField(
        default=False,
        help_text="Controls host visibility of attribution insights; tracking collection remains active."
    )
    analytics_enabled_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when host enabled attribution insights visibility."
    )
    analytics_enabled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='analytics_enabled_events',
        help_text="Host user who enabled attribution insights visibility."
    )
    
    # Custom fields from CSV imports
    custom_fields_metadata = models.JSONField(default=dict, blank=True, help_text="Metadata for custom CSV columns: normalized key -> display label mapping")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'events'
        ordering = ['-created_at']
    
    @property
    def is_expired(self):
        """Check if event is expired based on expiry_date or date"""
        from datetime import date
        expiry = self.expiry_date or self.date
        if not expiry:
            return False
        return expiry < date.today()
    
    def upgrade_to_envelope_if_needed(self):
        """Automatically upgrade event to ENVELOPE when conditions are met"""
        if self.event_structure == 'SIMPLE':
            # Check if any upgrade conditions are met
            # Use cached count instead of querying database
            has_sub_events = self.total_sub_events_count > 0
            has_event_carousel = self.page_config.get('tiles', []) if isinstance(self.page_config, dict) else []
            has_event_carousel = any(t.get('type') == 'event-carousel' for t in has_event_carousel)
            has_guest_assignments = GuestSubEventInvite.objects.filter(guest__event=self).exists()
            
            if has_sub_events or has_event_carousel or has_guest_assignments:
                self.event_structure = 'ENVELOPE'
                self.save(update_fields=['event_structure', 'updated_at'])
    
    def save(self, *args, **kwargs):
        """Normalize slug to lowercase before saving"""
        if self.slug:
            self.slug = self.slug.lower()
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.title} ({self.slug})"

    def get_canonical_rsvp_mode(self):
        """
        Return the active RSVP experience mode.

        This preserves backward compatibility for historical rows where mode could be
        inferred from legacy fields and slot-booking setup.
        """
        if self.event_structure == 'ENVELOPE':
            return self.RSVP_EXPERIENCE_MODE_SUB_EVENT

        if self.rsvp_experience_mode in {
            self.RSVP_EXPERIENCE_MODE_STANDARD,
            self.RSVP_EXPERIENCE_MODE_SUB_EVENT,
            self.RSVP_EXPERIENCE_MODE_SLOT_BASED,
            self.RSVP_EXPERIENCE_MODE_AUTO_CONFIRM,
        }:
            return self.rsvp_experience_mode

        schedule = getattr(self, 'booking_schedule', None)
        if schedule and schedule.is_enabled:
            has_active_slots = BookingSlot.objects.filter(
                event=self,
                status=BookingSlot.STATUS_AVAILABLE,
            ).exists()
            if has_active_slots:
                return self.RSVP_EXPERIENCE_MODE_SLOT_BASED

        return self.RSVP_EXPERIENCE_MODE_STANDARD

    def get_rsvp_mode_readiness(self):
        """Evaluate readiness for the currently active RSVP experience mode."""
        mode = self.get_canonical_rsvp_mode()
        reasons = []

        if not self.has_rsvp:
            reasons.append('RSVP is disabled for this event.')

        if mode in {self.RSVP_EXPERIENCE_MODE_STANDARD, self.RSVP_EXPERIENCE_MODE_AUTO_CONFIRM}:
            return {
                'mode': mode,
                'ready': bool(self.has_rsvp),
                'reasons': reasons,
            }

        if mode == self.RSVP_EXPERIENCE_MODE_SUB_EVENT:
            has_enabled_sub_events = SubEvent.objects.filter(
                event=self,
                is_removed=False,
                rsvp_enabled=True,
            ).exists()
            if not has_enabled_sub_events:
                reasons.append('Add at least one RSVP-enabled sub-event.')
            return {
                'mode': mode,
                'ready': bool(self.has_rsvp and has_enabled_sub_events),
                'reasons': reasons,
            }

        schedule = getattr(self, 'booking_schedule', None)
        schedule_enabled = bool(schedule and schedule.is_enabled)
        if not schedule_enabled:
            reasons.append('Bookings are currently paused.')

        has_active_slots = BookingSlot.objects.filter(
            event=self,
            status=BookingSlot.STATUS_AVAILABLE,
        ).exists()
        if not has_active_slots:
            reasons.append('Add at least one active slot.')

        return {
            'mode': mode,
            'ready': bool(self.has_rsvp and schedule_enabled and has_active_slots),
            'reasons': reasons,
        }

    def get_mode_switch_lock_info(self):
        """
        Whether changing rsvp_experience_mode is blocked by existing guest data.
        Matches EventSerializer mode-switch guardrail (non-removed RSVPs or confirmed bookings).
        """
        has_live_rsvps = RSVP.objects.filter(event=self, is_removed=False).exists()
        has_live_bookings = SlotBooking.objects.filter(
            event=self,
            status=SlotBooking.STATUS_CONFIRMED,
        ).exists()
        reasons = []
        if has_live_rsvps:
            reasons.append('This event has RSVP responses.')
        if has_live_bookings:
            reasons.append('This event has confirmed slot bookings.')
        return {
            'locked': has_live_rsvps or has_live_bookings,
            'reasons': reasons,
        }

    def get_rsvp_yes_attendee_count(self):
        """Count unique main-event RSVPs with will_attend=yes (one per phone/guest)."""
        qs = RSVP.objects.filter(
            event=self,
            is_removed=False,
            will_attend='yes',
            sub_event__isnull=True,
        ).only('id', 'phone', 'guest_id')
        seen = set()
        count = 0
        for rsvp in qs:
            key = rsvp.phone or (f'guest:{rsvp.guest_id}' if rsvp.guest_id else f'rsvp:{rsvp.id}')
            if key in seen:
                continue
            seen.add(key)
            count += 1
        return count

    def is_rsvp_registration_full(self):
        mode = self.get_canonical_rsvp_mode()
        if mode not in {
            self.RSVP_EXPERIENCE_MODE_STANDARD,
            self.RSVP_EXPERIENCE_MODE_AUTO_CONFIRM,
        }:
            return False
        if not self.rsvp_block_on_full_capacity or not self.rsvp_total_capacity:
            return False
        return self.get_rsvp_yes_attendee_count() >= self.rsvp_total_capacity

    def find_main_rsvp_by_phone(self, phone, country_code=None):
        """Return the main (non sub-event) RSVP row for a phone, if any."""
        import re

        from .utils import format_phone_with_country_code, get_country_code, parse_phone_number

        event_country_code = get_country_code(self.country)
        if phone and not str(phone).startswith('+'):
            phone = format_phone_with_country_code(phone, country_code or event_country_code)

        phone_digits_only = re.sub(r'\D', '', phone or '')
        provided_country_code = country_code or event_country_code

        existing_rsvp = RSVP.objects.filter(
            event=self,
            phone=phone,
            sub_event__isnull=True,
            is_removed=False,
        ).first()

        if existing_rsvp:
            return existing_rsvp

        for rsvp in RSVP.objects.filter(event=self, sub_event__isnull=True, is_removed=False):
            rsvp_phone_digits = re.sub(r'\D', '', rsvp.phone or '')
            if rsvp_phone_digits == phone_digits_only:
                return rsvp
            if len(phone_digits_only) >= 10 and len(rsvp_phone_digits) >= 10:
                local_number = phone_digits_only[-10:]
                if rsvp_phone_digits.endswith(local_number):
                    stored_country_code, _ = parse_phone_number(rsvp.phone)
                    if stored_country_code == provided_country_code:
                        return rsvp
        return None

    def can_phone_submit_yes_rsvp(self, existing_rsvp=None):
        """Whether this phone may submit or keep a yes/confirm RSVP when capacity is full."""
        if not self.is_rsvp_registration_full():
            return True
        return existing_rsvp is not None and existing_rsvp.will_attend == 'yes'

    def rsvp_capacity_is_full_for_new_yes(self, existing_rsvp=None):
        """True when blocking is on, capacity is set, and a new yes would exceed it."""
        if not self.is_rsvp_registration_full():
            return False
        if existing_rsvp and existing_rsvp.will_attend == 'yes':
            return False
        return True


class InvitePage(models.Model):
    """Interactive invitation page with floating elements and motion"""
    event = models.OneToOneField(Event, on_delete=models.CASCADE, related_name='invite_page')
    slug = models.SlugField(unique=True, max_length=100, blank=True, help_text="Auto-generated if not provided")
    background_url = models.TextField(blank=True, help_text="Background image URL or data URL")
    config = models.JSONField(default=dict, help_text="Draft invite configuration (edited in the page editor, auto-saved)")
    published_config = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text="Live snapshot served to guests. Copied from config on publish; null until first publish.",
    )
    is_published = models.BooleanField(default=False, help_text="Whether the invite page is publicly accessible")
    published_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp of the last publish. Retained when pulled back so guests see a Coming Soon page.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'invite_pages'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['slug', 'is_published'], name='invite_slug_pub_idx'),
        ]
    
    def __str__(self):
        return f"Invite for {self.event.title} ({self.slug})"
    
    # Fix 5: State machine property
    @property
    def state(self) -> str:
        """Return current state of invite page"""
        if not self.pk:  # Not saved yet
            return "not_created"
        if self.is_published:
            return "published"
        # Previously published but pulled back -> guests see a Coming Soon page
        if self.published_at is not None:
            return "paused"
        return "draft"
    
    def get_state_display(self) -> str:
        """Human-readable state"""
        state_map = {
            "not_created": "Not Created",
            "draft": "Draft",
            "published": "Published",
            "paused": "Coming Soon",
        }
        return state_map.get(self.state, "Unknown")
    
    def save(self, *args, **kwargs):
        # Always sync slug with event.slug to prevent drift
        # This ensures InvitePage.slug always matches Event.slug
        try:
            # Get event slug - prefer loaded event, fallback to event_id query
            event_slug = None
            if self.event and hasattr(self.event, 'slug') and self.event.slug:
                # Event is already loaded
                event_slug = self.event.slug
            elif self.event_id:
                # Event not loaded - query only slug field to avoid full object load
                try:
                    event_slug = Event.objects.values_list('slug', flat=True).get(pk=self.event_id)
                except Event.DoesNotExist:
                    # Event was deleted - can't sync slug, keep existing
                    pass
            
            if event_slug:
                self.slug = event_slug.lower()
        except Exception:
            # If slug sync fails for any reason, keep existing slug
            # Don't break the save operation - this is defensive programming
            pass
        
        # Always normalize slug to lowercase
        if self.slug:
            self.slug = self.slug.lower()
        super().save(*args, **kwargs)
        
        # Invalidate cache when invite page is updated
        if self.pk and self.slug:  # Only if already saved and has slug
            from django.core.cache import cache
            import logging
            logger = logging.getLogger(__name__)
            cache_key = f'invite_page:{self.slug}'
            cache.delete(cache_key)
            logger.info(
                f"[Cache] INVALIDATE - slug: {self.slug}, key: {cache_key}, "
                f"reason: invite_page_updated"
            )


class Guest(models.Model):
    """Invited guest list - managed by host"""
    SOURCE_CHOICES = [
        ('manual', 'Manual'),
        ('file_import', 'File Import (CSV/TXT/XLS/XLSX)'),
        ('contact_import', 'Contact Import (vCard/VCF)'),
        ('api_import', 'API Import (JSON/contact-picker)'),
        ('form_submission', 'Form Submission (RSVP/Slot Booking)'),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='guest_list')
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)  # Required - format: +91XXXXXXXXXX (with country code)
    country_iso = models.CharField(max_length=2, blank=True, help_text="ISO 3166-1 alpha-2 country code for analytics (e.g., IN, US, CA)")
    email = models.EmailField(blank=True, null=True)
    relationship = models.CharField(max_length=100, blank=True, help_text="e.g., Family, Friends, Colleagues")
    notes = models.TextField(blank=True)
    is_removed = models.BooleanField(default=False, help_text="Soft delete flag - guest is removed but record preserved")
    
    # Guest token for private invite links
    guest_token = models.CharField(max_length=64, unique=True, db_index=True, null=True, blank=True, help_text="Random token for guest-specific invite links")
    
    # Custom fields from CSV imports
    custom_fields = models.JSONField(default=dict, blank=True, help_text="Custom field values from CSV imports (normalized key -> value)")
    
    # Invitation tracking
    invitation_sent = models.BooleanField(default=False, help_text="Whether invitation has been sent to this guest")
    invitation_sent_at = models.DateTimeField(null=True, blank=True, help_text="Timestamp when invitation was sent")

    # Where this guest record originated from (unified host guest list filtering).
    source = models.CharField(
        max_length=20,
        choices=SOURCE_CHOICES,
        default='manual',
        db_index=True,
        help_text="Origin of guest record (manual/import/rsvp submission).",
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'guests'
        unique_together = [['event', 'phone']]  # Phone is unique per event
        ordering = ['name']

    def save(self, *args, **kwargs):
        """
        Ensure every guest has a tokenized invite key.

        We generate the token on create (and only if missing) so every newly-added
        guest gets a stable `guest_token` usable for invite variable resolution and
        RSVP autofill links.
        """
        import secrets

        # Only auto-generate on create to avoid surprising updates during partial saves.
        should_generate = self._state.adding and not self.guest_token

        # Retry a few times in the extremely unlikely event of a token collision.
        for _ in range(5):
            if should_generate and not self.guest_token:
                self.guest_token = secrets.token_urlsafe(32)  # 32 bytes = ~43 chars
            try:
                return super().save(*args, **kwargs)
            except IntegrityError:
                # If the failure was caused by a token collision, clear and retry.
                # If it's due to other constraints (e.g., duplicate phone), this will
                # still raise after retries.
                if should_generate:
                    self.guest_token = None
                    continue
                raise
        # Final attempt: let the IntegrityError surface with full context.
        return super().save(*args, **kwargs)
    
    def generate_guest_token(self):
        """Generate a random, unguessable token for guest-specific invite links"""
        import secrets
        if not self.guest_token:
            self.guest_token = secrets.token_urlsafe(32)  # 32 bytes = ~43 chars
            self.save(update_fields=['guest_token'])
        return self.guest_token
    
    def __str__(self):
        return f"{self.name} - {self.event.title}"


class SubEvent(models.Model):
    """Sub-events within an envelope event (e.g., Haldi, Mehndi, Sangeet, Wedding, Reception)"""
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='sub_events')
    title = models.CharField(max_length=255)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField(null=True, blank=True)
    location = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True, null=True)
    image_url = models.TextField(blank=True, null=True)
    background_color = models.CharField(max_length=7, blank=True, null=True, help_text="Background color for sub-event image (hex format, e.g., #FFFFFF)")
    rsvp_enabled = models.BooleanField(default=True)
    is_public_visible = models.BooleanField(default=False, help_text="Visible on public invite links without guest token")
    is_removed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'sub_events'
        ordering = ['start_at']
        indexes = [
            models.Index(fields=['event', 'is_public_visible', 'is_removed'], name='sub_events_event_visible_idx'),
            models.Index(fields=['event', 'is_removed', 'start_at'], name='sub_events_event_order_idx'),
        ]
    
    def __str__(self):
        return f"{self.title} - {self.event.title}"


class AttributionLink(models.Model):
    """Short redirect links for destination-specific attribution tracking."""
    TARGET_TYPE_CHOICES = [
        ('invite', 'Invite'),
        ('rsvp', 'RSVP'),
        ('registry', 'Registry'),
    ]
    CHANNEL_CHOICES = [
        ('qr', 'QR Code'),
        ('link', 'Web Link'),
    ]

    token = models.CharField(max_length=16, unique=True, db_index=True)
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='attribution_links')
    guest = models.ForeignKey(Guest, on_delete=models.SET_NULL, null=True, blank=True, related_name='attribution_links')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_attribution_links')

    target_type = models.CharField(max_length=20, choices=TARGET_TYPE_CHOICES)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default='qr')
    campaign = models.CharField(max_length=100, blank=True, default='')
    placement = models.CharField(max_length=100, blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)

    is_active = models.BooleanField(default=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    click_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'attribution_links'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event', 'target_type', 'channel'], name='attr_links_event_target_idx'),
            models.Index(fields=['event', 'guest'], name='attr_links_event_guest_idx'),
            models.Index(fields=['is_active', 'expires_at'], name='attr_links_active_exp_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['event', 'target_type'],
                condition=Q(is_active=True),
                name='attr_links_event_target_active_unique',
            ),
        ]

    @property
    def is_expired(self):
        return bool(self.expires_at and self.expires_at <= timezone.now())

    def __str__(self):
        return f"{self.event_id}:{self.target_type}:{self.token}"


class AttributionClick(models.Model):
    """Immutable click events for attribution links."""
    attribution_link = models.ForeignKey(AttributionLink, on_delete=models.CASCADE, related_name='clicks')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='attribution_clicks')
    guest = models.ForeignKey(Guest, on_delete=models.SET_NULL, null=True, blank=True, related_name='attribution_clicks')

    target_type = models.CharField(max_length=20, choices=AttributionLink.TARGET_TYPE_CHOICES)
    channel = models.CharField(max_length=20, choices=AttributionLink.CHANNEL_CHOICES, default='qr')
    campaign = models.CharField(max_length=100, blank=True, default='')
    placement = models.CharField(max_length=100, blank=True, default='')

    ip_hash = models.CharField(max_length=64, blank=True, default='')
    user_agent = models.TextField(blank=True, default='')
    referer = models.TextField(blank=True, default='')
    clicked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attribution_clicks'
        ordering = ['-clicked_at']
        indexes = [
            models.Index(fields=['event', 'target_type', '-clicked_at'], name='attr_clicks_event_target_idx'),
            models.Index(fields=['attribution_link', '-clicked_at'], name='attr_clicks_link_time_idx'),
            models.Index(fields=['channel', '-clicked_at'], name='attr_clicks_channel_idx'),
        ]

    def __str__(self):
        return f"{self.attribution_link.token} @ {self.clicked_at}"


class InvitePageView(models.Model):
    """Track when personalized invite links are opened"""
    guest = models.ForeignKey(Guest, on_delete=models.CASCADE, related_name='invite_views')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='invite_views')
    attribution_link = models.ForeignKey(AttributionLink, on_delete=models.SET_NULL, null=True, blank=True, related_name='invite_page_views')
    source_channel = models.CharField(
        max_length=20,
        choices=[('qr', 'QR Code'), ('link', 'Web Link'), ('manual', 'Manual')],
        default='link'
    )
    campaign = models.CharField(max_length=100, blank=True, default='')
    placement = models.CharField(max_length=100, blank=True, default='')
    viewed_at = models.DateTimeField(
        help_text='When the guest actually viewed the page (from cached timestamp)'
    )

    class Meta:
        db_table = 'invite_page_views'
        indexes = [
            models.Index(fields=['guest', '-viewed_at'], name='invite_views_guest_idx'),
            models.Index(fields=['event', '-viewed_at'], name='invite_views_event_idx'),
            models.Index(fields=['event', 'source_channel', '-viewed_at'], name='invite_views_event_src_idx'),
            models.Index(fields=['event', 'guest'], name='invite_views_event_guest_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['guest', 'event', 'viewed_at'],
                name='invite_views_unique_guest_event_time',
            ),
        ]
        ordering = ['-viewed_at']
    
    def __str__(self):
        return f"{self.guest.name} viewed invite at {self.viewed_at}"


class RSVPPageView(models.Model):
    """Track when guests open RSVP pages"""
    guest = models.ForeignKey(Guest, on_delete=models.CASCADE, related_name='rsvp_views')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='rsvp_views')
    attribution_link = models.ForeignKey(AttributionLink, on_delete=models.SET_NULL, null=True, blank=True, related_name='rsvp_page_views')
    source_channel = models.CharField(
        max_length=20,
        choices=[('qr', 'QR Code'), ('link', 'Web Link'), ('manual', 'Manual')],
        default='link'
    )
    campaign = models.CharField(max_length=100, blank=True, default='')
    placement = models.CharField(max_length=100, blank=True, default='')
    viewed_at = models.DateTimeField(
        help_text='When the guest actually viewed the page (from cached timestamp)'
    )

    class Meta:
        db_table = 'rsvp_page_views'
        indexes = [
            models.Index(fields=['guest', '-viewed_at'], name='rsvp_views_guest_idx'),
            models.Index(fields=['event', '-viewed_at'], name='rsvp_views_event_idx'),
            models.Index(fields=['event', 'source_channel', '-viewed_at'], name='rsvp_views_event_src_idx'),
            models.Index(fields=['event', 'guest'], name='rsvp_views_event_guest_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['guest', 'event', 'viewed_at'],
                name='rsvp_views_unique_guest_event_time',
            ),
        ]
        ordering = ['-viewed_at']
    
    def __str__(self):
        return f"{self.guest.name} viewed RSVP at {self.viewed_at}"


class RegistryPageView(models.Model):
    """Track when guests open the registry page"""
    guest = models.ForeignKey(Guest, on_delete=models.CASCADE, related_name='registry_views')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='registry_views')
    viewed_at = models.DateTimeField(
        help_text='When the guest viewed the registry page'
    )

    class Meta:
        ordering = ['-viewed_at']
        indexes = [
            models.Index(fields=['event', 'guest'], name='registry_views_event_guest_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['guest', 'event', 'viewed_at'],
                name='registry_views_unique_guest_event_time',
            ),
        ]

    def __str__(self):
        return f"{self.guest.name} viewed registry at {self.viewed_at}"


class AnalyticsBatchRun(models.Model):
    """Track batch processing runs for analytics collection"""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    
    run_id = models.CharField(max_length=100, unique=True, help_text="Unique identifier for this batch run")
    collection_window_start = models.DateTimeField(
        help_text='Start of the analytics collection window this batch covers'
    )
    processed_at = models.DateTimeField(null=True, blank=True, help_text="When batch was processed")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Statistics
    views_collected = models.IntegerField(default=0, help_text="Total views collected from cache")
    views_deduplicated = models.IntegerField(default=0, help_text="Views after deduplication")
    views_inserted = models.IntegerField(default=0, help_text="Views actually inserted to database")
    invite_views_count = models.IntegerField(default=0, help_text="Number of invite views in this batch")
    rsvp_views_count = models.IntegerField(default=0, help_text="Number of RSVP views in this batch")
    
    # Performance metrics
    processing_time_ms = models.IntegerField(null=True, blank=True, help_text="Processing time in milliseconds")
    
    # Error handling
    error_message = models.TextField(null=True, blank=True, help_text="Error message if processing failed")
    
    # Additional metadata
    metadata = models.JSONField(default=dict, blank=True, help_text="Additional statistics and metadata")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'analytics_batch_runs'
        ordering = ['-collection_window_start']
        indexes = [
            models.Index(fields=['status', '-collection_window_start'], name='batch_runs_status_idx'),
            models.Index(fields=['-processed_at'], name='batch_runs_processed_idx'),
        ]
    
    def __str__(self):
        return f"Batch {self.run_id} - {self.status} ({self.views_inserted} views)"


class GuestSubEventInvite(models.Model):
    """Join table linking guests to sub-events they're invited to"""
    guest = models.ForeignKey('Guest', on_delete=models.CASCADE, related_name='sub_event_invites')
    sub_event = models.ForeignKey(SubEvent, on_delete=models.CASCADE, related_name='guest_invites')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'guest_sub_event_invites'
        unique_together = [['guest', 'sub_event']]
    
    def __str__(self):
        return f"{self.guest.name} - {self.sub_event.title}"


class RSVP(models.Model):
    STATUS_CHOICES = [
        ('yes', 'Yes'),
        ('no', 'No'),
        ('maybe', 'Maybe'),
    ]
    
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='rsvps')
    sub_event = models.ForeignKey(SubEvent, on_delete=models.CASCADE, null=True, blank=True, related_name='rsvps', help_text="NULL for SIMPLE events, set for ENVELOPE events")
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)  # Format: +91XXXXXXXXXX (with country code)
    email = models.EmailField(blank=True, null=True)
    will_attend = models.CharField(max_length=10, choices=STATUS_CHOICES)
    guests_count = models.IntegerField(default=1, help_text="Total guests including the respondent")
    notes = models.TextField(blank=True)

    # Host-configured RSVP form answers (from guest custom fields)
    custom_fields = models.JSONField(default=dict, blank=True, help_text="RSVP custom answers (normalized key -> value)")
    
    # Link to guest list if this RSVP matches an invited guest
    guest = models.ForeignKey(Guest, on_delete=models.SET_NULL, null=True, blank=True, related_name='rsvps')
    
    # Source tracking
    source_channel = models.CharField(
        max_length=20,
        choices=[('qr', 'QR Code'), ('link', 'Web Link'), ('manual', 'Manual')],
        default='link'
    )
    
    is_removed = models.BooleanField(default=False, help_text="Soft delete flag - RSVP is removed but record preserved")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'rsvps'
        # Note: unique_together with nullable sub_event requires special handling
        # We'll use a database-level partial unique index or application-level validation
        unique_together = [['event', 'phone', 'sub_event']]
        ordering = ['-created_at']
    
    def __str__(self):
        sub_event_str = f" - {self.sub_event.title}" if self.sub_event else ""
        return f"{self.name} - {self.event.title}{sub_event_str} - {self.will_attend}"


class BookingSchedule(models.Model):
    """Event-level slot booking settings."""

    VISIBILITY_EXACT = 'exact'
    VISIBILITY_BUCKETED = 'bucketed'
    VISIBILITY_HIDDEN = 'hidden'
    SEAT_VISIBILITY_CHOICES = [
        (VISIBILITY_EXACT, 'Exact'),
        (VISIBILITY_BUCKETED, 'Bucketed'),
        (VISIBILITY_HIDDEN, 'Hidden'),
    ]

    event = models.OneToOneField(Event, on_delete=models.CASCADE, related_name='booking_schedule')
    is_enabled = models.BooleanField(default=False)
    seat_visibility_mode = models.CharField(
        max_length=20,
        choices=SEAT_VISIBILITY_CHOICES,
        default=VISIBILITY_EXACT,
    )
    allow_direct_bookings = models.BooleanField(default=True)
    allow_host_capacity_override = models.BooleanField(default=True)
    booking_open_days_before = models.IntegerField(null=True, blank=True)
    booking_close_hours_before = models.IntegerField(null=True, blank=True)
    timezone = models.CharField(max_length=64, blank=True, default='')
    status_changed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_schedules'

    def __str__(self):
        return f"Booking schedule - {self.event.title}"


class BookingSlot(models.Model):
    """Bookable slot for RSVP flow."""

    STATUS_AVAILABLE = 'available'
    STATUS_UNAVAILABLE = 'unavailable'
    STATUS_SOLD_OUT = 'sold_out'
    STATUS_HIDDEN = 'hidden'
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, 'Available'),
        (STATUS_UNAVAILABLE, 'Unavailable'),
        (STATUS_SOLD_OUT, 'Sold Out'),
        (STATUS_HIDDEN, 'Hidden'),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='booking_slots')
    schedule = models.ForeignKey(BookingSchedule, on_delete=models.CASCADE, related_name='slots')
    slot_date = models.DateField(help_text='Event timezone date for this slot')
    start_at = models.DateTimeField(help_text='Stored in UTC')
    end_at = models.DateTimeField(help_text='Stored in UTC')
    label = models.CharField(max_length=255, blank=True, default='')
    display_order = models.IntegerField(default=0)
    capacity_total = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'booking_slots'
        ordering = ['slot_date', 'display_order', 'start_at']
        indexes = [
            models.Index(fields=['event', 'slot_date', 'status'], name='bslot_evt_date_stat_idx'),
            models.Index(fields=['event', 'slot_date', 'display_order', 'start_at'], name='booking_slots_event_order_idx'),
        ]

    def __str__(self):
        return f"{self.event.title} - {self.slot_date} {self.start_at.isoformat()}"


class SlotBooking(models.Model):
    """Guest booking against a specific slot."""

    SOURCE_INVITED = 'invited'
    SOURCE_DIRECT = 'direct'
    SOURCE_CHOICES = [
        (SOURCE_INVITED, 'Invited'),
        (SOURCE_DIRECT, 'Direct'),
    ]

    STATUS_CONFIRMED = 'confirmed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_NO_SHOW = 'no_show'
    STATUS_CHOICES = [
        (STATUS_CONFIRMED, 'Confirmed'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_NO_SHOW, 'No Show'),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='slot_bookings')
    slot = models.ForeignKey(BookingSlot, on_delete=models.CASCADE, related_name='bookings')
    guest = models.ForeignKey(Guest, on_delete=models.SET_NULL, null=True, blank=True, related_name='slot_bookings')
    phone_snapshot = models.CharField(max_length=20)
    name_snapshot = models.CharField(max_length=255, blank=True, default='')
    email_snapshot = models.EmailField(blank=True, null=True)
    seats_booked = models.IntegerField(default=1)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default=SOURCE_DIRECT)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_CONFIRMED)
    idempotency_key = models.CharField(max_length=100, blank=True, null=True)
    booked_at = models.DateTimeField(auto_now_add=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_by_host = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_slot_bookings',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'slot_bookings'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event', 'slot', 'status'], name='sbook_evt_slot_stat_idx'),
            models.Index(fields=['event', 'guest'], name='slot_bookings_event_guest_idx'),
            models.Index(fields=['event', 'phone_snapshot'], name='slot_bookings_event_phone_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['event', 'guest'],
                condition=Q(status='confirmed', guest__isnull=False),
                name='slot_bookings_event_guest_confirmed_unique',
            ),
            models.UniqueConstraint(
                fields=['event', 'phone_snapshot'],
                condition=Q(status='confirmed', guest__isnull=True),
                name='slot_bookings_event_phone_confirmed_unique',
            ),
            models.UniqueConstraint(
                fields=['event', 'idempotency_key'],
                condition=Q(idempotency_key__isnull=False),
                name='slot_bookings_event_idempotency_unique',
            ),
        ]

    def __str__(self):
        return f"{self.phone_snapshot} - {self.slot_id} ({self.status})"


class MessageTemplateManager(models.Manager):
    def visible_to(self, event):
        """Return templates visible to a host event: their own + EkFern global live templates."""
        return self.get_queryset().filter(
            Q(event=event) |
            Q(event__isnull=True, meta_approved=True, is_live=True)
        )


class MessageTemplate(models.Model):
    """Message templates for event updates — host-owned (event set) or EkFern-global (event=NULL)."""

    CHANNEL_WHATSAPP = 'whatsapp'
    CHANNEL_EMAIL = 'email'
    CHANNEL_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('email', 'Email'),
    ]

    MESSAGE_TYPE_CHOICES = [
        ('invitation', 'Initial Invitation'),
        ('reminder', 'Reminder'),
        ('update', 'Event Update'),
        ('venue_change', 'Venue Change'),
        ('time_change', 'Time Change'),
        ('thank_you', 'Thank You'),
        ('custom', 'Custom Message'),
    ]

    objects = MessageTemplateManager()

    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name='message_templates',
        null=True, blank=True,
        help_text="NULL = EkFern-owned global template; set = host-owned template"
    )
    name = models.CharField(max_length=100, help_text="Template name (e.g., 'Initial Invitation', 'Venue Change Update')")
    message_type = models.CharField(
        max_length=50,
        choices=MESSAGE_TYPE_CHOICES,
        default='custom',
        help_text="Type of message/update being sent"
    )
    channel = models.CharField(
        max_length=20, choices=CHANNEL_CHOICES, default=CHANNEL_WHATSAPP,
        help_text="Delivery channel this template targets"
    )
    meta_approved = models.BooleanField(
        default=False,
        help_text="True if this template is registered and approved in Meta Business Manager"
    )
    meta_template_name = models.CharField(
        max_length=200, blank=True, null=True,
        help_text="Exact template name in Meta Business Manager (only relevant when meta_approved=True)"
    )
    meta_template_language = models.CharField(
        max_length=20, blank=True, null=True,
        help_text="Language code for the Meta template (e.g. en, hi)"
    )
    is_live = models.BooleanField(
        default=True,
        help_text="Global templates only: visible to hosts when True AND meta_approved=True"
    )
    subject = models.CharField(
        max_length=500, blank=True, null=True,
        help_text="Email subject line (channel=email only)"
    )
    is_rich_text = models.BooleanField(
        default=False,
        help_text="If True, template_text is HTML; if False, plain text (email only)"
    )
    template_text = models.TextField(
        help_text="Template with variables like [name], [event_title], [event_date], [event_url], [host_name], [event_location]"
    )
    description = models.TextField(
        blank=True,
        help_text="Optional description of when/why to use this template"
    )
    usage_count = models.IntegerField(
        default=0,
        help_text="Number of times this template has been used to send messages"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this template is active and can be used"
    )
    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When this template was last used to send a message"
    )
    is_default = models.BooleanField(
        default=False,
        help_text="Whether this is the default template for the event (only one per event)"
    )
    is_system_default = models.BooleanField(
        default=False,
        help_text="Whether this is the system-wide default template (only one globally, non-deletable)"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_message_templates',
        help_text="User who created this template"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'message_templates'
        ordering = ['-last_used_at', '-created_at']
        indexes = [
            models.Index(fields=['event', 'channel'], name='msgtpl_event_channel_idx'),
            models.Index(fields=['event', 'message_type'], name='msgtpl_event_msgtype_idx'),
            models.Index(fields=['meta_approved', 'is_live'], name='msgtpl_approved_live_idx'),
            models.Index(fields=['is_system_default'], name='msgtpl_sysdefault_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['event', 'name', 'channel'],
                condition=models.Q(event__isnull=False),
                name='unique_template_name_per_event_channel'
            ),
            models.UniqueConstraint(
                fields=['event', 'is_default'],
                condition=models.Q(is_default=True),
                name='unique_default_per_event'
            ),
            models.UniqueConstraint(
                fields=['is_system_default'],
                condition=models.Q(is_system_default=True),
                name='unique_system_default'
            ),
        ]
    
    def __str__(self):
        event_label = self.event.title if self.event_id else 'Global'
        return f"{self.name} - {event_label}"

    def save(self, *args, **kwargs):
        """Override save to ensure only one default per event and one system default globally"""
        if self.is_default:
            # Unset other defaults for this event
            MessageTemplate.objects.filter(event=self.event, is_default=True).exclude(id=self.id).update(is_default=False)
        
        if self.is_system_default:
            # Unset other system defaults
            MessageTemplate.objects.filter(is_system_default=True).exclude(id=self.id).update(is_system_default=False)
        
        super().save(*args, **kwargs)
    
    def delete(self, *args, **kwargs):
        """Prevent deletion of system default templates"""
        if self.is_system_default:
            from django.core.exceptions import PermissionDenied
            raise PermissionDenied("System default templates cannot be deleted.")
        super().delete(*args, **kwargs)
    
    def increment_usage(self):
        """Increment usage count and update last_used_at"""
        from django.utils import timezone
        self.usage_count += 1
        self.last_used_at = timezone.now()
        self.save(update_fields=['usage_count', 'last_used_at'])
    
    def get_preview(self, sample_data=None):
        """Generate preview with sample data"""
        if not sample_data:
            event = self.event
            if event:
                date_str = event.date.strftime('%B %d, %Y') if event.date else 'TBD'
                sample_data = {
                    'name': 'Sarah',
                    'event_title': event.title,
                    'event_date': date_str,
                    'event_url': f"https://example.com/invite/{event.slug}",
                    'host_name': (event.host.name if event.host else '') or 'Host',
                    'event_location': event.city or 'Location TBD',
                }
            else:
                sample_data = {
                    'name': 'Sarah',
                    'event_title': 'Your Event',
                    'event_date': 'June 15, 2026',
                    'event_url': 'https://ekfern.com/invite/example',
                    'host_name': 'Host',
                    'event_location': 'Venue TBD',
                }
        
        # Simple variable replacement for preview
        message = self.template_text
        replacements = {
            '[name]': sample_data.get('name', ''),
            '[event_title]': sample_data.get('event_title', ''),
            '[event_date]': sample_data.get('event_date', ''),
            '[event_url]': sample_data.get('event_url', ''),
            '[host_name]': sample_data.get('host_name', ''),
            '[event_location]': sample_data.get('event_location', ''),
        }
        
        for variable, value in replacements.items():
            message = message.replace(variable, value)

        return message


class MetaApprovedTemplate(models.Model):
    """EkFern-managed Meta-approved WhatsApp templates for bulk sending."""

    MESSAGE_TYPE_CHOICES = [
        ('invitation', 'Invitation'),
        ('reminder', 'Reminder'),
        ('update', 'Update'),
        ('venue_change', 'Venue Change'),
        ('time_change', 'Time Change'),
        ('thank_you', 'Thank You'),
        ('custom', 'Custom'),
    ]

    display_name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True)
    preview_text = models.TextField(help_text='Template body shown to hosts. Use [name], [event_title] etc.')
    meta_template_name = models.CharField(max_length=100, unique=True, help_text='Exact name registered in Meta Business Manager.')
    meta_template_language = models.CharField(max_length=10, default='en')
    message_type = models.CharField(max_length=50, choices=MESSAGE_TYPE_CHOICES, default='invitation')
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='meta_approved_templates')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'meta_approved_templates'
        ordering = ['message_type', 'display_name']

    def __str__(self):
        return f"{self.display_name} ({self.meta_template_name})"


class GuestSegment(models.Model):
    SEGMENT_TYPE_CHOICES = [('fixed', 'Fixed'), ('dynamic', 'Dynamic')]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='guest_segments')
    name = models.CharField(max_length=100)
    segment_type = models.CharField(max_length=10, choices=SEGMENT_TYPE_CHOICES, default='fixed')
    filter_config = models.JSONField(default=dict, blank=True)
    guest_ids = models.JSONField(default=list)  # resolved cache, updated on create/resolve
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'guest_segments'
        ordering = ['name']
        unique_together = [('event', 'name')]

    def __str__(self):
        return f"{self.name} ({self.event_id})"


class MessageCampaign(models.Model):
    """Bulk WhatsApp send campaign targeting a subset of event guests."""

    STATUS_PENDING = 'pending'
    STATUS_SENDING = 'sending'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sending', 'Sending'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    ]

    MSG_MODE_FREEFORM = 'freeform'
    MSG_MODE_TEMPLATE = 'approved_template'
    MSG_MODE_CHOICES = [
        ('freeform', 'Free-form text (24h window only)'),
        ('approved_template', 'Meta pre-approved template'),
    ]

    FILTER_ALL = 'all'
    FILTER_NOT_SENT = 'not_sent'
    FILTER_RSVP_YES = 'rsvp_yes'
    FILTER_RSVP_NO = 'rsvp_no'
    FILTER_RSVP_MAYBE = 'rsvp_maybe'
    FILTER_RSVP_PENDING = 'rsvp_pending'
    FILTER_RELATIONSHIP = 'relationship'
    FILTER_CUSTOM = 'custom_selection'
    FILTER_BOOKING_SLOT = 'booking_slot'
    FILTER_BOOKING_DATE = 'booking_date'
    FILTER_BOOKING_STATUS = 'booking_status'
    FILTER_CHOICES = [
        ('all', 'All guests'),
        ('not_sent', 'Not yet invited'),
        ('rsvp_yes', 'RSVP confirmed'),
        ('rsvp_no', 'RSVP declined'),
        ('rsvp_maybe', 'RSVP maybe'),
        ('rsvp_pending', 'No RSVP yet'),
        ('relationship', 'By relationship group'),
        ('custom_selection', 'Manually selected guests'),
        ('booking_slot', 'By booking slot'),
        ('booking_date', 'By booking date'),
        ('booking_status', 'By booking status'),
    ]

    CHANNEL_WHATSAPP = 'whatsapp'
    CHANNEL_EMAIL = 'email'
    CHANNEL_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('email', 'Email'),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='campaigns')
    name = models.CharField(max_length=200)
    channel = models.CharField(
        max_length=20, choices=CHANNEL_CHOICES, default=CHANNEL_WHATSAPP,
        help_text="Delivery channel for this campaign"
    )
    template = models.ForeignKey(
        'MessageTemplate', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='campaigns'
    )
    message_mode = models.CharField(
        max_length=30, choices=MSG_MODE_CHOICES, default=MSG_MODE_TEMPLATE
    )
    message_body = models.TextField(
        help_text="Raw template text used for this campaign (variables resolved per-recipient at send time)"
    )
    subject = models.CharField(
        max_length=300, blank=True, default='',
        help_text="Email subject line (email channel only; falls back to campaign name if blank)"
    )
    meta_template_name = models.CharField(
        max_length=200, blank=True,
        help_text="Approved template name registered in Meta Business Manager"
    )
    meta_template_language = models.CharField(
        max_length=20, blank=True, default='en',
        help_text="Language code for the Meta approved template (e.g. en, hi)"
    )
    guest_filter = models.CharField(
        max_length=30, choices=FILTER_CHOICES, default=FILTER_ALL
    )
    filter_relationship = models.CharField(
        max_length=100, blank=True,
        help_text="Only used when guest_filter = relationship"
    )
    custom_guest_ids = models.JSONField(
        default=list, blank=True,
        help_text="Guest PKs when guest_filter = custom_selection"
    )
    filter_slot_id = models.IntegerField(
        null=True, blank=True,
        help_text="Only used when guest_filter = booking_slot",
    )
    filter_slot_date = models.DateField(
        null=True, blank=True,
        help_text="Only used when guest_filter = booking_date",
    )
    filter_booking_status = models.CharField(
        max_length=20, blank=True, default='',
        help_text="Only used when guest_filter = booking_status",
    )
    scheduled_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Future UTC datetime to start sending; null = send immediately on launch"
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    qualified_count = models.IntegerField(
        default=0,
        help_text="Guests matching the filter regardless of contact info (set at dispatch time)"
    )
    total_recipients = models.IntegerField(default=0)
    sent_count = models.IntegerField(default=0)
    delivered_count = models.IntegerField(default=0)
    read_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_campaigns'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'message_campaigns'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['event', 'status'], name='campaigns_event_status_idx'),
            models.Index(fields=['event', 'created_at'], name='campaigns_event_created_idx'),
            models.Index(fields=['scheduled_at'], name='campaigns_scheduled_at_idx'),
        ]

    def __str__(self):
        return f"{self.name} ({self.event.title}) - {self.status}"


class CampaignRecipient(models.Model):
    """One row per guest per campaign — tracks individual delivery state."""

    STATUS_PENDING = 'pending'
    STATUS_SENT = 'sent'
    STATUS_DELIVERED = 'delivered'
    STATUS_READ = 'read'
    STATUS_FAILED = 'failed'
    STATUS_SKIPPED = 'skipped'
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent to Meta'),
        ('delivered', 'Delivered to device'),
        ('read', 'Read by recipient'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ]

    campaign = models.ForeignKey(
        MessageCampaign, on_delete=models.CASCADE, related_name='recipients'
    )
    guest = models.ForeignKey(
        'Guest', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='campaign_recipients'
    )
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(
        max_length=254, blank=True,
        help_text="Snapshot of guest email at send time (for email channel)"
    )
    resolved_message = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    whatsapp_message_id = models.CharField(
        max_length=200, blank=True, db_index=True,
        help_text="wamid returned by Meta Cloud API — used for webhook correlation"
    )
    email_message_id = models.CharField(
        max_length=200, blank=True, db_index=True,
        help_text="SES Message-ID — used for delivery webhook correlation"
    )
    error_message = models.TextField(blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'campaign_recipients'
        unique_together = [['campaign', 'guest']]
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['campaign', 'status'], name='recipients_campaign_status_idx'),
        ]

    def __str__(self):
        return f"Recipient {self.phone or self.email} in {self.campaign.name} - {self.status}"


class HostSendQuota(models.Model):
    """Per-host, per-channel monthly send quota. Usage is counted from CampaignRecipient rows."""

    CHANNEL_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('email', 'Email'),
    ]

    host = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='send_quotas',
        help_text="The event host this quota applies to"
    )
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    monthly_limit = models.IntegerField(
        help_text="Maximum messages per calendar month (0 = blocked)"
    )
    set_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='quotas_set',
        help_text="Staff member who configured this quota"
    )
    notes = models.TextField(blank=True, help_text="Internal notes about this quota")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'host_send_quotas'
        unique_together = [['host', 'channel']]
        ordering = ['host', 'channel']

    def __str__(self):
        return f"{self.host} — {self.channel}: {self.monthly_limit}/mo"

    def usage_this_month(self):
        """Count sent/delivered/read CampaignRecipient rows for host's events this calendar month."""
        now = timezone.now()
        return CampaignRecipient.objects.filter(
            campaign__event__host=self.host,
            campaign__channel=self.channel,
            status__in=['sent', 'delivered', 'read'],
            sent_at__year=now.year,
            sent_at__month=now.month,
        ).count()


class InvitePageLayout(models.Model):
    """
    Backend-stored invite page layouts for the Page Layout Studio.
    Staff (and later creators) design layouts using the tile system; hosts pick from the library.
    """
    VISIBILITY_CHOICES = [
        ('internal', 'Internal'),
        ('public', 'Public'),
        ('premium', 'Premium'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    thumbnail = models.URLField(max_length=2000, blank=True)
    card_sample = models.ForeignKey(
        'GreetingCardSample',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='layouts',
        help_text='Design this layout was created for. Drives design-based layout filtering.',
    )
    preview_alt = models.CharField(max_length=255, blank=True)
    config = models.JSONField(default=dict, help_text='Full InviteConfig: themeId, tiles, customColors, texture, etc.')
    visibility = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='public')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_invite_page_layouts')
    updated_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_invite_page_layouts',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Future: premium and creator revenue share
    is_premium = models.BooleanField(default=False)
    price_cents = models.IntegerField(null=True, blank=True)
    creator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='creator_invite_page_layouts',
    )
    creator_share_percent = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'invite_page_layouts'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['visibility'], name='invite_pl_visibility_idx'),
            models.Index(fields=['status'], name='invite_pl_status_idx'),
            models.Index(fields=['visibility', 'status'], name='invite_pl_vis_status_idx'),
        ]

    def __str__(self):
        return self.name


class GreetingCardSample(models.Model):
    """
    Staff-curated greeting card samples for the card designer.
    Each sample has a background image (S3/CloudFront URL) and placeholder text overlays.
    Hosts browse these in the card designer and can customise the text before saving.
    The background_image_url and text_overlays are snapshot-copied into InvitePage.config
    at save time — this record is NOT referenced by guest-facing invite rendering.
    """
    name = models.CharField(max_length=200)
    code = models.CharField(
        max_length=32,
        unique=True,
        blank=True,
        help_text='Stable human-friendly identifier (e.g. DSGN-0042) used to link layouts to this design.',
    )
    description = models.TextField(blank=True)
    background_image_url = models.URLField(max_length=500)
    thumbnail_url = models.URLField(
        max_length=500,
        blank=True,
        help_text='Small derivative (e.g. ~360px wide) used in the catalog grid. Falls back to background_image_url when empty.',
    )
    text_overlays = models.JSONField(
        default=list,
        help_text='Same shape as ImageTile.settings.textOverlays — placeholder text positioned on the card.',
    )
    ASPECT_RATIO_CHOICES = [
        ('9:16', '9:16 — Portrait phone'),
        ('1:1',  '1:1 — Square'),
        ('4:5',  '4:5 — Instagram portrait'),
        ('3:4',  '3:4 — Standard portrait'),
        ('16:9', '16:9 — Landscape'),
    ]
    aspect_ratio = models.CharField(
        max_length=10,
        choices=ASPECT_RATIO_CHOICES,
        default='9:16',
        help_text='Canvas aspect ratio for this design (e.g. 9:16, 1:1).',
    )
    tags = models.JSONField(default=list, help_text='e.g. ["wedding", "floral", "minimalist"]')
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='greeting_card_samples',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'greeting_card_samples'
        ordering = ['sort_order', '-created_at']

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.code:
            self.code = f'DSGN-{self.pk:04d}'
            super().save(update_fields=['code'])

    def __str__(self):
        return self.name


class WaitlistEntry(models.Model):
    """
    Generic feature-interest waitlist. One row per user per feature.
    Use feature_slug to distinguish features (e.g. 'bulk_whatsapp', 'premium_templates').
    """
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='waitlist_entries',
    )
    feature_slug = models.CharField(
        max_length=100,
        help_text="Identifier for the feature (e.g. 'bulk_whatsapp')",
    )
    event = models.ForeignKey(
        'Event', null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
        help_text='Optional — the event context where interest was expressed',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'waitlist_entries'
        unique_together = [['user', 'feature_slug']]
        ordering = ['-created_at']
        verbose_name = 'Waitlist Entry'
        verbose_name_plural = 'Waitlist Entries'

    def __str__(self):
        return f"{self.user.email} → {self.feature_slug}"


class WhatsAppSettings(models.Model):
    """
    Singleton model — only one row (pk=1) is ever created.
    Super admin configures WhatsApp Cloud API credentials here via the Django admin.
    Falls back to env vars (WHATSAPP_ENABLED etc.) if no DB record exists.
    """
    enabled = models.BooleanField(
        default=False,
        help_text='Master switch. Must be True to send any WhatsApp messages.',
    )
    phone_number_id = models.CharField(max_length=100, blank=True, help_text='Meta Business phone number ID')
    access_token = models.CharField(max_length=1000, blank=True, help_text='Meta Cloud API permanent access token')
    app_secret = models.CharField(max_length=300, blank=True, help_text='Meta app secret (for webhook verification)')
    webhook_verify_token = models.CharField(max_length=200, blank=True, default='change_me', help_text='Token for Meta webhook verification handshake')
    send_delay_seconds = models.FloatField(default=0.2, help_text='Delay in seconds between consecutive sends (rate limiting)')
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )

    class Meta:
        db_table = 'whatsapp_settings'
        verbose_name = 'WhatsApp Settings'
        verbose_name_plural = 'WhatsApp Settings'

    def __str__(self):
        return f"WhatsApp Settings ({'enabled' if self.enabled else 'disabled'})"

    def save(self, *args, **kwargs):
        from django.core.cache import cache
        self.pk = 1  # Singleton — always pk=1
        super().save(*args, **kwargs)
        cache.delete('whatsapp_settings')

    @classmethod
    def get_config(cls) -> dict:
        """
        Returns a config dict from DB (cached 60 s) or falls back to env vars.
        Always safe to call — never raises.
        """
        from django.core.cache import cache
        from django.conf import settings as django_settings

        cached = cache.get('whatsapp_settings')
        if cached is not None:
            return cached

        try:
            obj = cls.objects.get(pk=1)
            config = {
                'enabled': obj.enabled,
                'phone_number_id': obj.phone_number_id,
                'access_token': obj.access_token,
                'app_secret': obj.app_secret,
                'webhook_verify_token': obj.webhook_verify_token or 'change_me',
                'send_delay_seconds': obj.send_delay_seconds,
            }
        except cls.DoesNotExist:
            config = {
                'enabled': getattr(django_settings, 'WHATSAPP_ENABLED', False),
                'phone_number_id': getattr(django_settings, 'WHATSAPP_PHONE_NUMBER_ID', ''),
                'access_token': getattr(django_settings, 'WHATSAPP_ACCESS_TOKEN', ''),
                'app_secret': getattr(django_settings, 'WHATSAPP_APP_SECRET', ''),
                'webhook_verify_token': getattr(django_settings, 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'change_me'),
                'send_delay_seconds': getattr(django_settings, 'WHATSAPP_SEND_DELAY_SECONDS', 0.2),
            }

        cache.set('whatsapp_settings', config, 60)
        return config


class LLMPlatformSettings(models.Model):
    """
    Singleton (pk=1) — operational LLM knobs for super-admins via Django admin.

    When no row exists, ``get_config()`` falls back to ``django.conf.settings``
    (environment / task definition), matching :class:`WhatsAppSettings`.
    """
    generation_enabled = models.BooleanField(
        default=False,
        help_text='Master switch for LLM generation (Page Layout Auto-Generator, etc.).',
    )
    cost_alert_email = models.EmailField(
        blank=True,
        help_text='Recipient for cost threshold and kill-switch alert emails.',
    )
    daily_cost_cap_usd = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('5.00'),
        help_text='Global daily spend cap in USD (ledger-based, all users).',
    )
    monthly_cost_cap_usd = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('50.00'),
        help_text='Global monthly spend cap in USD (ledger-based, all users).',
    )
    image_fetch_allowed_hosts = models.TextField(
        blank=True,
        help_text='Comma-separated host allowlist for server-side image fetches '
        '(*.suffix patterns allowed). Leave blank to use '
        'LLM_IMAGE_FETCH_ALLOWED_HOSTS from the environment.',
    )
    image_fetch_allow_private = models.BooleanField(
        default=False,
        help_text='Allow private/loopback DNS targets for image fetches. '
        'Local development only — keep False in staging and production.',
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+',
    )

    class Meta:
        db_table = 'llm_platform_settings'
        verbose_name = 'LLM Platform Settings'
        verbose_name_plural = 'LLM Platform Settings'

    def __str__(self):
        return f"LLM Platform Settings ({'on' if self.generation_enabled else 'off'})"

    def save(self, *args, **kwargs):
        from django.core.cache import cache

        self.pk = 1
        super().save(*args, **kwargs)
        cache.delete('llm_platform_settings')

    @classmethod
    def get_config(cls) -> dict:
        """
        Cached config dict from DB or env fallback. Safe to call — never raises.
        """
        from django.conf import settings as django_settings
        from django.core.cache import cache

        cached = cache.get('llm_platform_settings')
        if cached is not None:
            return cached

        def _split_hosts(raw: str) -> list[str]:
            if not raw:
                return []
            return [h.strip().lower() for h in raw.split(',') if h.strip()]

        def _hosts_from_env() -> list[str]:
            raw = getattr(django_settings, 'LLM_IMAGE_FETCH_ALLOWED_HOSTS', '') or ''
            hosts = _split_hosts(str(raw))
            if hosts:
                return hosts
            return ['*.amazonaws.com', '*.cloudfront.net']

        try:
            obj = cls.objects.get(pk=1)
            hosts_raw = (obj.image_fetch_allowed_hosts or '').strip()
            image_fetch_allowed_hosts = (
                _split_hosts(hosts_raw) if hosts_raw else _hosts_from_env()
            )
            config = {
                'generation_enabled': obj.generation_enabled,
                'cost_alert_email': (obj.cost_alert_email or '').strip(),
                'daily_cost_cap_usd': float(obj.daily_cost_cap_usd),
                'monthly_cost_cap_usd': float(obj.monthly_cost_cap_usd),
                'image_fetch_allowed_hosts': image_fetch_allowed_hosts,
                'image_fetch_allow_private': bool(obj.image_fetch_allow_private),
            }
        except cls.DoesNotExist:
            config = {
                'generation_enabled': bool(
                    getattr(django_settings, 'LLM_GENERATION_ENABLED', False)
                ),
                'cost_alert_email': (
                    getattr(django_settings, 'LLM_COST_ALERT_EMAIL', '') or ''
                ).strip(),
                'daily_cost_cap_usd': float(
                    getattr(django_settings, 'LLM_DAILY_COST_CAP_USD', 5.0)
                ),
                'monthly_cost_cap_usd': float(
                    getattr(django_settings, 'LLM_MONTHLY_COST_CAP_USD', 50.0)
                ),
                'image_fetch_allowed_hosts': _hosts_from_env(),
                'image_fetch_allow_private': bool(
                    getattr(django_settings, 'LLM_IMAGE_FETCH_ALLOW_PRIVATE', False)
                ),
            }

        cache.set('llm_platform_settings', config, 60)
        return config


class LLMUsageLedger(models.Model):
    """
    Persistent ledger of every external LLM call made by the platform.

    Source of truth for per-user, per-day, and per-month spend used by the
    Page Layout Auto-Generator and any future LLM-powered feature. All cap
    checks read from this table — never from cache — so a Redis flush, ECS
    task restart, or in-memory reset cannot reset the spend window.

    Every successful or failed call writes one row before returning. Cache
    hits are also recorded with `cache_hit=True` and `cost_usd=0` so the
    cost dashboard shows realized spend accurately.
    """
    OPERATION_CHOICES = [
        ('vision', 'Vision'),
        ('text', 'Text'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='llm_usage',
        help_text='Superuser who triggered the call. Null only if the call was system-initiated.',
    )
    request_id = models.CharField(
        max_length=64,
        db_index=True,
        help_text='Client-supplied idempotency key. Same request_id within 60s reuses the prior result.',
    )
    operation = models.CharField(max_length=32, choices=OPERATION_CHOICES)
    provider = models.CharField(max_length=32, default='anthropic')
    model = models.CharField(max_length=64)
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    # 10 digits, 6 decimal places: max $9,999.999999, granular to micro-USD.
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6, default=0)
    cache_hit = models.BooleanField(
        default=False,
        help_text='True when the call was served from cache and incurred no provider cost.',
    )
    success = models.BooleanField(default=True)
    error = models.TextField(blank=True)
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text='Arbitrary debug context: card_url, event_type, attempt #, etc.',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'llm_usage_ledger'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at'], name='llm_usage_user_time_idx'),
            models.Index(fields=['created_at', 'success'], name='llm_usage_time_success_idx'),
            models.Index(fields=['request_id', 'created_at'], name='llm_usage_request_idx'),
        ]
        verbose_name = 'LLM Usage Ledger Entry'
        verbose_name_plural = 'LLM Usage Ledger Entries'

    def __str__(self):
        cost = f'${self.cost_usd:.4f}' if not self.cache_hit else 'cached'
        return f'{self.created_at:%Y-%m-%d %H:%M} {self.operation} {self.model} ({cost})'


# Signal to keep InvitePage.slug in sync with Event.slug
@receiver(post_save, sender=Event)
def sync_invite_page_slug(sender, instance, **kwargs):
    """
    Keep InvitePage.slug synchronized with Event.slug.
    This ensures they never drift apart, even if Event.slug changes.
    """
    # Only sync if InvitePage exists
    if hasattr(instance, 'invite_page') and instance.invite_page:
        invite_page = instance.invite_page
        # Only update if slug differs (avoid unnecessary saves)
        if invite_page.slug != instance.slug.lower():
            invite_page.slug = instance.slug.lower()
            # Use update_fields to avoid triggering save() recursion
            invite_page.save(update_fields=['slug', 'updated_at'])


def update_event_sub_event_counts(event):
    """
    Update cached sub-event counts for an event.
    This is called automatically via signals when sub-events change.
    
    Args:
        event: Event instance to update counts for
    """
    from django.db import transaction
    
    # Use select_for_update to prevent race conditions in concurrent scenarios
    try:
        with transaction.atomic():
            # Reload event with lock to prevent concurrent updates
            event = Event.objects.select_for_update().get(pk=event.pk)
            
            # Calculate counts efficiently
            total_count = event.sub_events.filter(is_removed=False).count()
            public_count = event.sub_events.filter(
                is_public_visible=True,
                is_removed=False
            ).count()
            
            # Only update if values changed (avoid unnecessary writes)
            if (event.total_sub_events_count != total_count or 
                event.public_sub_events_count != public_count):
                event.total_sub_events_count = total_count
                event.public_sub_events_count = public_count
                event.save(update_fields=['total_sub_events_count', 'public_sub_events_count'])
                
                # Invalidate cache for the event's invite page when counts change
                try:
                    # Check if invite page exists and get its slug
                    invite_page_slug = InvitePage.objects.filter(event=event).values_list('slug', flat=True).first()
                    if invite_page_slug:
                        from django.core.cache import cache
                        import logging
                        logger = logging.getLogger(__name__)
                        cache_key = f'invite_page:{invite_page_slug}'
                        cache.delete(cache_key)
                        logger.info(
                            f"[Cache] INVALIDATE - slug: {invite_page_slug}, key: {cache_key}, "
                            f"reason: sub_event_count_changed"
                        )
                except Exception:
                    # If cache invalidation fails, don't break the count update
                    pass
    except Event.DoesNotExist:
        # Event was deleted, nothing to update
        pass
    except Exception:
        # If update fails for any reason, don't break the save operation
        # This is defensive programming - signals should not break normal operations
        pass


# Signal handlers for SubEvent to maintain cached counts
@receiver(post_save, sender=SubEvent)
def update_counts_on_subevent_save(sender, instance, created, **kwargs):
    """
    Update cached counts when SubEvent is created or updated.
    Fires immediately after save() completes.
    Handles:
    - New sub-event creation
    - Sub-event updates (including soft delete via is_removed=True)
    - Visibility changes (is_public_visible toggle)
    - Any field changes (title, location, description, etc.) - invalidates cache
    """
    if instance.event_id:  # Ensure event exists
        # Touch the InvitePage version (updated_at) so the version-scoped invite
        # cache key rotates on any sub-event change. This is globally consistent
        # across all containers (unlike per-container cache.delete with LocMemCache).
        # We also delete the local key as a best-effort cleanup for this container.
        try:
            import logging
            logger = logging.getLogger(__name__)
            updated = InvitePage.objects.filter(event_id=instance.event_id).update(
                updated_at=timezone.now()
            )
            if updated:
                from django.core.cache import cache
                invite_page_slug = InvitePage.objects.filter(
                    event_id=instance.event_id
                ).values_list('slug', flat=True).first()
                if invite_page_slug:
                    cache.delete(f'invite_page:{invite_page_slug}')
                logger.info(
                    f"[Cache] VERSION BUMP - event_id: {instance.event_id}, "
                    f"reason: sub_event_updated (id: {instance.id})"
                )
        except Exception:
            # If cache invalidation fails, don't break the save operation
            pass
        
        # Update cached counts
        update_event_sub_event_counts(instance.event)


@receiver(post_delete, sender=SubEvent)
def update_counts_on_subevent_delete(sender, instance, **kwargs):
    """
    Update cached counts when SubEvent is hard-deleted.
    Note: Soft deletes (is_removed=True) are handled by post_save.
    """
    # Store event_id before instance is deleted
    event_id = instance.event_id if hasattr(instance, 'event_id') else None
    if event_id:
        # Touch the InvitePage version (updated_at) so the version-scoped invite
        # cache key rotates on sub-event deletion (globally consistent).
        try:
            import logging
            logger = logging.getLogger(__name__)
            updated = InvitePage.objects.filter(event_id=event_id).update(
                updated_at=timezone.now()
            )
            if updated:
                from django.core.cache import cache
                invite_page_slug = InvitePage.objects.filter(
                    event_id=event_id
                ).values_list('slug', flat=True).first()
                if invite_page_slug:
                    cache.delete(f'invite_page:{invite_page_slug}')
                logger.info(
                    f"[Cache] VERSION BUMP - event_id: {event_id}, "
                    f"reason: sub_event_deleted"
                )
        except Exception:
            # If cache invalidation fails, don't break the delete operation
            pass
        
        try:
            # Get event directly by ID to avoid accessing deleted relationship
            event = Event.objects.get(pk=event_id)
            update_event_sub_event_counts(event)
        except Event.DoesNotExist:
            # Event was deleted, nothing to update
            pass

