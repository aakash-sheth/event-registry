from django.db import models
from apps.users.models import User


class Event(models.Model):
    EVENT_TYPE_CHOICES = [
        ('wedding', 'Wedding'),
        ('engagement', 'Engagement'),
        ('reception', 'Reception'),
        ('other', 'Other'),
    ]
    
    host = models.ForeignKey(User, on_delete=models.CASCADE, related_name='events')
    slug = models.SlugField(unique=True, max_length=100)
    title = models.CharField(max_length=255)
    event_type = models.CharField(max_length=50, choices=EVENT_TYPE_CHOICES, default='wedding')
    date = models.DateField(null=True, blank=True)
    city = models.CharField(max_length=255, blank=True)
    country = models.CharField(max_length=2, default='IN', help_text="ISO 3166-1 alpha-2 country code (e.g., IN, US, UK)")
    is_public = models.BooleanField(default=True)
    
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
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'guests'
        unique_together = [['event', 'phone']]  # Phone is unique per event
        ordering = ['name']
    
    def __str__(self):
        return f"{self.name} - {self.event.title}"


class RSVP(models.Model):
    STATUS_CHOICES = [
        ('yes', 'Yes'),
        ('no', 'No'),
        ('maybe', 'Maybe'),
    ]
    
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='rsvps')
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
        unique_together = [['event', 'phone']]  # One RSVP per phone per event
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} - {self.event.title} - {self.will_attend}"

