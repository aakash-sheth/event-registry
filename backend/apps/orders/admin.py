from django.contrib import admin
from .models import Order


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'event', 'buyer_name', 'buyer_email', 'amount_inr', 'status', 'created_at')
    list_filter = ('status', 'event', 'created_at')
    search_fields = ('buyer_name', 'buyer_email', 'buyer_phone', 'rzp_order_id', 'rzp_payment_id')
    readonly_fields = ('created_at', 'updated_at')

