from django.db import models
from apps.users.models import User


class Event(models.Model):
    EVENT_TYPE_CHOICES = [
        ('wedding', 'Wedding'),
        ('engagement', 'Engagement'),
        ('reception', 'Reception'),
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
    
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='events')
    slug = models.SlugField(unique=True, max_length=100)
    title = models.CharField(max_length=255)
    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES, default='wedding')
    date = models.DateField(null=True, blank=True)
    event_end_date = models.DateField(null=True, blank=True, help_text="End date for multi-day events (optional)")
    city = models.CharField(max_length=255, blank=True)
    country = models.CharField(max_length=2, default='IN', help_text="ISO 3166-1 alpha-2 country code (e.g., IN, US, UK)")
    is_public = models.BooleanField(default=True)
    
    # Event structure and RSVP mode
    event_structure = models.CharField(max_length=20, choices=EVENT_STRUCTURE_CHOICES, default='SIMPLE', help_text="SIMPLE: single event, ENVELOPE: event with sub-events")
    rsvp_mode = models.CharField(max_length=20, choices=RSVP_MODE_CHOICES, default='ONE_TAP_ALL', help_text="PER_SUBEVENT: RSVP per sub-event, ONE_TAP_ALL: single confirmation for all")
    
    # Feature toggles
    has_rsvp = models.BooleanField(default=True, help_text="Enable RSVP functionality for this event")
    has_registry = models.BooleanField(default=True, help_text="Enable Gift Registry functionality for this event")
    
    # Event page customization
    banner_image = models.TextField(blank=True, help_text="Banner image URL or data URL for public invitation page (deprecated - use page_config)")
    description = models.TextField(blank=True, help_text="Rich text description for public invitation page (deprecated - use page_config)")
    additional_photos = models.JSONField(default=list, blank=True, help_text="Array of up to 5 photo URLs or data URLs (deprecated - use page_config)")
    page_config = models.JSONField(default=dict, blank=True, help_text="Living Poster invitation page configuration with theme, hero, description")
    
    # Event expiry and messaging
    expiry_date = models.DateField(null=True, blank=True, help_text="Date when event expires (for impact calculation)")
    whatsapp_message_template = models.TextField(blank=True, help_text="Custom WhatsApp message template for sharing")
    
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
            has_sub_events = self.sub_events.exists()
            has_event_carousel = self.page_config.get('tiles', []) if isinstance(self.page_config, dict) else []
            has_event_carousel = any(t.get('type') == 'event-carousel' for t in has_event_carousel)
            has_guest_assignments = GuestSubEventInvite.objects.filter(guest__event=self).exists()
            
            if has_sub_events or has_event_carousel or has_guest_assignments:
                self.event_structure = 'ENVELOPE'
                self.save(update_fields=['event_structure', 'updated_at'])
    
    def __str__(self):
        return f"{self.title} ({self.slug})"


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
    
    def save(self, *args, **kwargs):
        if not self.slug:
            # Generate slug from event slug
            self.slug = f"{self.event.slug}-invite"
        super().save(*args, **kwargs)


class Guest(models.Model):
    """Invited guest list - managed by host"""
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
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'guests'
        unique_together = [['event', 'phone']]  # Phone is unique per event
        ordering = ['name']
    
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


class WhatsAppTemplate(models.Model):
    """WhatsApp message templates for event updates - one event can have multiple templates"""
    
    MESSAGE_TYPE_CHOICES = [
        ('invitation', 'Initial Invitation'),
        ('reminder', 'Reminder'),
        ('update', 'Event Update'),
        ('venue_change', 'Venue Change'),
        ('time_change', 'Time Change'),
        ('thank_you', 'Thank You'),
        ('custom', 'Custom Message'),
    ]
    
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='whatsapp_templates')
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
        related_name='created_whatsapp_templates',
        help_text="User who created this template"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'whatsapp_templates'
        ordering = ['-last_used_at', '-created_at']
        unique_together = [['event', 'name']]
        indexes = [
            models.Index(fields=['event', 'message_type']),
            models.Index(fields=['event', 'is_active']),
            models.Index(fields=['event', 'is_default']),
            models.Index(fields=['is_system_default']),
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
            WhatsAppTemplate.objects.filter(event=self.event, is_default=True).exclude(id=self.id).update(is_default=False)
        
        if self.is_system_default:
            # Unset other system defaults
            WhatsAppTemplate.objects.filter(is_system_default=True).exclude(id=self.id).update(is_system_default=False)
        
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

