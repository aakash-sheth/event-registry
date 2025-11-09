from django.db import models


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

