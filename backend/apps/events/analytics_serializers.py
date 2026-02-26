"""
Serializers for guest invite analytics
"""
from rest_framework import serializers
from .models import Guest, InvitePageView, RSVPPageView


class GuestAnalyticsSerializer(serializers.ModelSerializer):
    """Serializer for guest analytics data"""
    invite_views_count = serializers.SerializerMethodField()
    rsvp_views_count = serializers.SerializerMethodField()
    last_invite_view = serializers.SerializerMethodField()
    last_rsvp_view = serializers.SerializerMethodField()
    has_viewed_invite = serializers.SerializerMethodField()
    has_viewed_rsvp = serializers.SerializerMethodField()
    
    class Meta:
        model = Guest
        fields = (
            'id', 'name', 'phone', 'email',
            'invite_views_count', 'rsvp_views_count',
            'last_invite_view', 'last_rsvp_view',
            'has_viewed_invite', 'has_viewed_rsvp',
        )
    
    def get_invite_views_count(self, obj):
        """Get total number of invite page views for this guest"""
        return obj.invite_views.count()
    
    def get_rsvp_views_count(self, obj):
        """Get total number of RSVP page views for this guest"""
        return obj.rsvp_views.count()
    
    def get_last_invite_view(self, obj):
        """Get timestamp of last invite page view"""
        # Use order_by to ensure we get the most recent view
        last_view = obj.invite_views.order_by('-viewed_at').first()
        return last_view.viewed_at.isoformat() if last_view else None
    
    def get_last_rsvp_view(self, obj):
        """Get timestamp of last RSVP page view"""
        # Use order_by to ensure we get the most recent view
        last_view = obj.rsvp_views.order_by('-viewed_at').first()
        return last_view.viewed_at.isoformat() if last_view else None
    
    def get_has_viewed_invite(self, obj):
        """Check if guest has viewed invite page"""
        return obj.invite_views.exists()
    
    def get_has_viewed_rsvp(self, obj):
        """Check if guest has viewed RSVP page"""
        return obj.rsvp_views.exists()


class EventAnalyticsSummarySerializer(serializers.Serializer):
    """Serializer for event-level analytics summary"""
    total_guests = serializers.IntegerField()
    guests_with_invite_views = serializers.IntegerField()
    guests_with_rsvp_views = serializers.IntegerField()
    total_invite_views = serializers.IntegerField()
    total_rsvp_views = serializers.IntegerField()
    invite_view_rate = serializers.FloatField(help_text="Percentage of guests who viewed invite")
    rsvp_view_rate = serializers.FloatField(help_text="Percentage of guests who viewed RSVP")
    engagement_rate = serializers.FloatField(help_text="Percentage of guests who viewed both invite and RSVP")
    attribution_clicks_total = serializers.IntegerField(required=False, default=0)
    target_type_clicks = serializers.DictField(required=False, default=dict)
    source_channel_breakdown = serializers.DictField(required=False, default=dict)
    funnel = serializers.DictField(required=False, default=dict)
    insights_locked = serializers.BooleanField(required=False, default=True)
    insights_cta_label = serializers.CharField(required=False, allow_blank=True, default='')
    metric_definitions = serializers.DictField(required=False, default=dict)
