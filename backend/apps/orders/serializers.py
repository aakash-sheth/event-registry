from rest_framework import serializers
from .models import Order
from apps.events.serializers import EventSerializer
from apps.items.serializers import RegistryItemSerializer


class OrderSerializer(serializers.ModelSerializer):
    event = EventSerializer(read_only=True)
    item = RegistryItemSerializer(read_only=True)
    
    class Meta:
        model = Order
        fields = (
            'id', 'event', 'item', 'buyer_name', 'buyer_email', 'buyer_phone',
            'amount_inr', 'status', 'rzp_order_id', 'rzp_payment_id',
            'created_at', 'updated_at'
        )
        read_only_fields = (
            'id', 'status', 'rzp_order_id', 'rzp_payment_id', 'rzp_signature',
            'created_at', 'updated_at'
        )


class OrderCreateSerializer(serializers.Serializer):
    event_id = serializers.IntegerField()
    item_id = serializers.IntegerField(required=False, allow_null=True)
    buyer_name = serializers.CharField(max_length=255)
    buyer_email = serializers.EmailField()
    buyer_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)  # Format: +91XXXXXXXXXX or just digits
    country_code = serializers.CharField(required=False, allow_blank=True)  # Optional, defaults to event country
    amount_inr = serializers.IntegerField(required=False)  # Optional, server will validate

