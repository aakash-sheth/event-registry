from django.db import models
from apps.events.models import Event
from apps.items.models import RegistryItem


class Order(models.Model):
    STATUS_CHOICES = [
        ('created', 'Created'),
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]
    
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='orders')
    item = models.ForeignKey(RegistryItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    
    buyer_name = models.CharField(max_length=255)
    buyer_email = models.EmailField()
    buyer_phone = models.CharField(max_length=20, blank=True)  # Format: +91XXXXXXXXXX (with country code)
    
    amount_inr = models.IntegerField(help_text="Amount in paise")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='created')
    
    # Razorpay fields
    provider = models.CharField(max_length=50, default='razorpay')
    rzp_order_id = models.CharField(max_length=255, blank=True, null=True)
    rzp_payment_id = models.CharField(max_length=255, blank=True, null=True)
    rzp_signature = models.CharField(max_length=255, blank=True, null=True)
    
    # Feature flags (for future use)
    opt_in_whatsapp = models.BooleanField(default=False)
    preferred_lang = models.CharField(max_length=10, default='en', blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'orders'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Order {self.id} - {self.buyer_name} - ₹{self.amount_inr / 100}"

