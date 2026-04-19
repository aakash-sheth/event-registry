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
        ('corporate_event', 'Corporate Event'),
        ('conference', 'Conference'),
        ('seminar', 'Seminar'),
        ('workshop', 'Workshop'),
        ('networking', 'Networking Event'),
        ('product_launch', 'Product Launch'),
        ('team_building', 'Team Building'),
        ('award_ceremony', 'Award Ceremony'),
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
    RSVP_EXPERIENCE_MODE_CHOICES = [
        (RSVP_EXPERIENCE_MODE_STANDARD, 'Standard RSVP'),
        (RSVP_EXPERIENCE_MODE_SUB_EVENT, 'Sub-event RSVP'),
        (RSVP_EXPERIENCE_MODE_SLOT_BASED, 'Slot-based RSVP'),
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

        if mode == self.RSVP_EXPERIENCE_MODE_STANDARD:
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


class InvitePage(models.Model):
    """Interactive invitation page with floating elements and motion"""
    event = models.OneToOneField(Event, on_delete=models.CASCADE, related_name='invite_page')
    slug = models.SlugField(unique=True, max_length=100, blank=True, help_text="Auto-generated if not provided")
    background_url = models.TextField(blank=True, help_text="Background image URL or data URL")
    config = models.JSONField(default=dict, help_text="Invite configuration (elements, theme, parallax)")
    is_published = models.BooleanField(default=False, help_text="Whether the invite page is publicly accessible")
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
        return "draft"
    
    def get_state_display(self) -> str:
        """Human-readable state"""
        state_map = {
            "not_created": "Not Created",
            "draft": "Draft",
            "published": "Published",
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


class MessageTemplate(models.Model):
    """Message templates for event updates - one event can have multiple templates"""
    
    MESSAGE_TYPE_CHOICES = [
        ('invitation', 'Initial Invitation'),
        ('reminder', 'Reminder'),
        ('update', 'Event Update'),
        ('venue_change', 'Venue Change'),
        ('time_change', 'Time Change'),
        ('thank_you', 'Thank You'),
        ('custom', 'Custom Message'),
    ]
    
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='message_templates')
    name = models.CharField(max_length=100, help_text="Template name (e.g., 'Initial Invitation', 'Venue Change Update')")
    message_type = models.CharField(
        max_length=50,
        choices=MESSAGE_TYPE_CHOICES,
        default='custom',
        help_text="Type of message/update being sent"
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
        db_table = 'whatsapp_templates'
        ordering = ['-last_used_at', '-created_at']
        unique_together = [['event', 'name']]
        indexes = [
            models.Index(fields=['event', 'message_type'], name='whatsapp_te_event_i_idx'),
            models.Index(fields=['event', 'is_active'], name='whatsapp_te_event_i_idx2'),
            models.Index(fields=['event', 'is_default'], name='whatsapp_te_event_i_idx3'),
            models.Index(fields=['is_system_default'], name='whatsapp_te_is_syst_idx'),
        ]
        constraints = [
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
        return f"{self.name} - {self.event.title}"
    
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
            from datetime import date
            date_str = self.event.date.strftime('%B %d, %Y') if self.event.date else 'TBD'
            sample_data = {
                'name': 'Sarah',
                'event_title': self.event.title,
                'event_date': date_str,
                'event_url': f"https://example.com/invite/{self.event.slug}",
                'host_name': self.event.host.name or 'Host',
                'event_location': self.event.city or 'Location TBD'
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

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='campaigns')
    name = models.CharField(max_length=200)
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
    phone = models.CharField(max_length=20)
    resolved_message = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    whatsapp_message_id = models.CharField(
        max_length=200, blank=True, db_index=True,
        help_text="wamid returned by Meta Cloud API — used for webhook correlation"
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
        return f"Recipient {self.phone} in {self.campaign.name} - {self.status}"


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
    description = models.TextField(blank=True)
    background_image_url = models.URLField(max_length=500)
    text_overlays = models.JSONField(
        default=list,
        help_text='Same shape as ImageTile.settings.textOverlays — placeholder text positioned on the card.',
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

    def __str__(self):
        return self.name


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
        # Always invalidate cache when sub-event is saved (any field change)
        # This ensures invite page shows updated sub-event details immediately
        try:
            invite_page_slug = InvitePage.objects.filter(event_id=instance.event_id).values_list('slug', flat=True).first()
            if invite_page_slug:
                from django.core.cache import cache
                import logging
                logger = logging.getLogger(__name__)
                cache_key = f'invite_page:{invite_page_slug}'
                cache.delete(cache_key)
                logger.info(
                    f"[Cache] INVALIDATE - slug: {invite_page_slug}, key: {cache_key}, "
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
        # Invalidate cache when sub-event is deleted
        try:
            invite_page_slug = InvitePage.objects.filter(event_id=event_id).values_list('slug', flat=True).first()
            if invite_page_slug:
                from django.core.cache import cache
                import logging
                logger = logging.getLogger(__name__)
                cache_key = f'invite_page:{invite_page_slug}'
                cache.delete(cache_key)
                logger.info(
                    f"[Cache] INVALIDATE - slug: {invite_page_slug}, key: {cache_key}, "
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

