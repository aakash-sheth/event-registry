from django.contrib import admin
from apps.users.admin import admin_site
from .models import Order


class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'event', 'buyer_name', 'buyer_email', 'amount_inr', 'status', 'created_at')
    list_filter = ('status', 'event', 'created_at')
    search_fields = ('buyer_name', 'buyer_email', 'buyer_phone', 'rzp_order_id', 'rzp_payment_id')
    readonly_fields = ('created_at', 'updated_at')
    
    def amount_inr(self, obj):
        """Display amount in rupees"""
        return f"₹{obj.amount_inr / 100}"
    amount_inr.short_description = 'Amount'


# Register with custom admin site
admin_site.register(Order, OrderAdmin)

