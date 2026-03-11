import uuid
from django.db import models
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


class NotificationLog(models.Model):
    CHANNEL_CHOICES = [
        ('email', 'Email'),
        ('whatsapp', 'WhatsApp'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
    ]

    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    to = models.CharField(max_length=255)  # email or phone
    template = models.CharField(max_length=100, blank=True)
    payload_json = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    last_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notification_logs'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.channel} to {self.to} - {self.status}"


class NotificationPreference(models.Model):
    FREQUENCY_CHOICES = [
        ('immediately', 'Immediately'),
        ('daily_digest', 'Daily Digest'),
        ('never', 'Never'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_preferences',
    )
    rsvp_new = models.CharField(
        max_length=20, choices=FREQUENCY_CHOICES, default='immediately',
        help_text='How often to notify when a new RSVP is submitted',
    )
    gift_received = models.CharField(
        max_length=20, choices=FREQUENCY_CHOICES, default='immediately',
        help_text='How often to notify when a gift is received',
    )
    marketing_emails = models.BooleanField(
        default=True,
        help_text='Receive product updates and tips from Ekfern',
    )
    unsubscribe_token = models.UUIDField(
        default=uuid.uuid4, unique=True, editable=False,
        help_text='Token for one-click unsubscribe links in email footers',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notification_preferences'

    def __str__(self):
        return f"Prefs for {self.user.email}"


class NotificationQueue(models.Model):
    """Holds pending digest notifications waiting to be batched and sent."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notification_queue',
    )
    notification_type = models.CharField(max_length=50)  # 'rsvp_new', 'gift_received'
    payload_json = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)  # null = pending

    class Meta:
        db_table = 'notification_queue'
        ordering = ['created_at']

    def __str__(self):
        status = 'sent' if self.sent_at else 'pending'
        return f"{self.notification_type} for {self.user.email} ({status})"


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_notification_preference(sender, instance, created, **kwargs):
    """Auto-create default notification preferences when a new user is created."""
    if created:
        NotificationPreference.objects.get_or_create(user=instance)
