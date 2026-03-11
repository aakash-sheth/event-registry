from rest_framework import serializers
from .models import NotificationPreference


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = ('rsvp_new', 'gift_received', 'marketing_emails', 'updated_at')
        read_only_fields = ('updated_at',)
