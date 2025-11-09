from django.db import models
from apps.events.models import Event


class RegistryItem(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('hidden', 'Hidden'),
    ]
    
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    image_url = models.URLField(blank=True, null=True, max_length=500)
    price_inr = models.IntegerField(help_text="Price in paise (e.g., 50000 = ₹500)")
    qty_total = models.IntegerField(default=1)
    qty_purchased = models.IntegerField(default=0)
    priority_rank = models.IntegerField(default=0, help_text="Lower number = higher priority")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'registry_items'
        ordering = ['priority_rank', 'name']
    
    def __str__(self):
        return f"{self.name} - {self.event.title}"
    
    @property
    def remaining(self):
        return self.qty_total - self.qty_purchased
    
    @property
    def is_available(self):
        return self.status == 'active' and self.remaining > 0

