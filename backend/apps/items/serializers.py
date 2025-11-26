from rest_framework import serializers
from .models import RegistryItem
from apps.events.serializers import EventSerializer


class RegistryItemSerializer(serializers.ModelSerializer):
    event = EventSerializer(read_only=True)
    remaining = serializers.IntegerField(read_only=True)
    is_available = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = RegistryItem
        fields = (
            'id', 'event', 'name', 'description', 'image_url', 'price_inr',
            'qty_total', 'qty_purchased', 'remaining', 'priority_rank',
            'status', 'item_type', 'is_available', 'created_at', 'updated_at'
        )
        read_only_fields = ('id', 'qty_purchased', 'created_at', 'updated_at')


class RegistryItemCreateSerializer(serializers.ModelSerializer):
    event_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = RegistryItem
        fields = (
            'name', 'description', 'image_url', 'price_inr',
            'qty_total', 'priority_rank', 'status', 'item_type', 'event_id'
        )
        extra_kwargs = {
            'description': {'required': False, 'allow_blank': True},
            'image_url': {'required': False, 'allow_blank': True, 'allow_null': True},
        }
    
    def validate_image_url(self, value):
        """Validate image URL - allow empty string or valid URL"""
        if not value or value == '':
            return None
        # Basic URL validation - Django's URLField will handle the rest
        return value

