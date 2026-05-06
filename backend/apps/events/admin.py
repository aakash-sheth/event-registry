from django import forms
from django.contrib import admin
from django.forms import PasswordInput
from apps.users.admin import admin_site
from .models import Event, Guest, RSVP, InvitePage, SubEvent, GuestSubEventInvite, MessageTemplate, AnalyticsBatchRun, GreetingCardSample, HostSendQuota, WhatsAppSettings, WaitlistEntry


class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'host', 'event_type', 'date', 'is_public', 'show_branding', 'created_at')
    list_filter = ('event_type', 'is_public', 'show_branding', 'created_at')
    search_fields = ('title', 'slug', 'city')
    readonly_fields = ('created_at', 'updated_at')

    def save_model(self, request, obj, form, change):
        old_show_branding = None
        if change and obj.pk:
            old_show_branding = Event.objects.filter(pk=obj.pk).values_list('show_branding', flat=True).first()
        super().save_model(request, obj, form, change)
        if change and old_show_branding is not None and old_show_branding != obj.show_branding:
            if hasattr(obj, 'invite_page') and obj.invite_page:
                from .views import invalidate_invite_page_cache, invalidate_cloudfront_cache_immediate
                invalidate_invite_page_cache(obj.invite_page.slug)
                invalidate_cloudfront_cache_immediate(obj.invite_page.slug)


class GuestAdmin(admin.ModelAdmin):
    list_display = ('name', 'event', 'phone', 'email', 'relationship', 'is_removed', 'created_at')
    list_filter = ('is_removed', 'relationship', 'created_at')
    search_fields = ('name', 'phone', 'email', 'event__title')
    readonly_fields = ('created_at', 'updated_at')


class RSVPAdmin(admin.ModelAdmin):
    list_display = ('name', 'event', 'sub_event', 'phone', 'will_attend', 'guests_count', 'is_removed', 'created_at')
    list_filter = ('will_attend', 'is_removed', 'source_channel', 'created_at')
    search_fields = ('name', 'phone', 'email', 'event__title', 'sub_event__title')
    readonly_fields = ('created_at', 'updated_at')


class SubEventAdmin(admin.ModelAdmin):
    list_display = ('title', 'event', 'start_at', 'end_at', 'location', 'rsvp_enabled', 'is_public_visible', 'is_removed', 'created_at')
    list_filter = ('rsvp_enabled', 'is_public_visible', 'is_removed', 'created_at')
    search_fields = ('title', 'event__title', 'location')
    readonly_fields = ('created_at', 'updated_at')


class GuestSubEventInviteAdmin(admin.ModelAdmin):
    list_display = ('guest', 'sub_event', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('guest__name', 'sub_event__title', 'guest__event__title')
    readonly_fields = ('created_at',)


class InvitePageAdmin(admin.ModelAdmin):
    list_display = ('event', 'slug', 'is_published', 'created_at')
    list_filter = ('is_published', 'created_at')
    search_fields = ('slug', 'event__title')
    readonly_fields = ('created_at', 'updated_at')


class MessageTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'event', 'message_type', 'is_active', 'is_default', 'is_system_default', 'usage_count', 'created_at')
    list_filter = ('message_type', 'is_active', 'is_default', 'is_system_default', 'created_at')
    search_fields = ('name', 'event__title', 'template_text')
    readonly_fields = ('usage_count', 'last_used_at', 'created_at', 'updated_at')
    raw_id_fields = ('event', 'created_by')


class AnalyticsBatchRunAdmin(admin.ModelAdmin):
    list_display = ('run_id', 'status_badge', 'collection_window_start', 'processed_at', 'views_collected', 'views_deduplicated', 'views_inserted', 'processing_time_ms')
    list_filter = ('status', 'collection_window_start', 'processed_at')
    search_fields = ('run_id', 'error_message')
    readonly_fields = ('run_id', 'collection_window_start', 'processed_at', 'status', 'views_collected', 'views_deduplicated',
                      'views_inserted', 'invite_views_count', 'rsvp_views_count', 'processing_time_ms',
                      'error_message', 'metadata', 'created_at', 'updated_at')
    ordering = ('-collection_window_start',)
    
    def status_badge(self, obj):
        """Display status with color coding"""
        colors = {
            'completed': 'green',
            'failed': 'red',
            'processing': 'orange',
            'pending': 'gray',
        }
        color = colors.get(obj.status, 'gray')
        return f'<span style="color: {color}; font-weight: bold;">{obj.get_status_display()}</span>'
    status_badge.short_description = 'Status'
    status_badge.allow_tags = True
    
    fieldsets = (
        ('Run Information', {
            'fields': ('run_id', 'status', 'collection_window_start', 'processed_at')
        }),
        ('Statistics', {
            'fields': ('views_collected', 'views_deduplicated', 'views_inserted', 
                      'invite_views_count', 'rsvp_views_count', 'processing_time_ms')
        }),
        ('Error Information', {
            'fields': ('error_message',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )


class GreetingCardSampleAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'sort_order', 'created_by', 'created_at')
    list_filter = ('is_active', 'created_at')
    search_fields = ('name', 'description', 'tags')
    readonly_fields = ('created_by', 'created_at', 'updated_at')
    raw_id_fields = ('created_by',)


# Register with custom admin site
admin_site.register(Event, EventAdmin)
admin_site.register(Guest, GuestAdmin)
admin_site.register(RSVP, RSVPAdmin)
admin_site.register(InvitePage, InvitePageAdmin)
admin_site.register(SubEvent, SubEventAdmin)
admin_site.register(GuestSubEventInvite, GuestSubEventInviteAdmin)
admin_site.register(MessageTemplate, MessageTemplateAdmin)
admin_site.register(AnalyticsBatchRun, AnalyticsBatchRunAdmin)
admin_site.register(GreetingCardSample, GreetingCardSampleAdmin)


@admin.register(HostSendQuota)
class HostSendQuotaAdmin(admin.ModelAdmin):
    list_display = ('host', 'channel', 'monthly_limit', 'set_by', 'updated_at')
    list_filter = ('channel',)
    search_fields = ('host__email', 'host__name')
    raw_id_fields = ('host', 'set_by')
    readonly_fields = ('created_at', 'updated_at')


admin_site.register(HostSendQuota, HostSendQuotaAdmin)


class WhatsAppSettingsForm(forms.ModelForm):
    access_token = forms.CharField(
        widget=PasswordInput(render_value=True), required=False,
        help_text='Meta Cloud API permanent access token',
    )
    app_secret = forms.CharField(
        widget=PasswordInput(render_value=True), required=False,
        help_text='Meta app secret (for webhook verification)',
    )
    webhook_verify_token = forms.CharField(
        widget=PasswordInput(render_value=True), required=False,
        help_text='Token for Meta webhook verification handshake',
    )

    class Meta:
        model = WhatsAppSettings
        fields = '__all__'


class WhatsAppSettingsAdmin(admin.ModelAdmin):
    form = WhatsAppSettingsForm
    fieldsets = [
        ('Master Switch', {
            'fields': ['enabled'],
            'description': 'Toggle WhatsApp messaging on or off across the entire platform.',
        }),
        ('Meta Cloud API Credentials', {
            'fields': ['phone_number_id', 'access_token', 'app_secret', 'webhook_verify_token'],
            'description': 'Obtain these from the Meta Business Manager → WhatsApp → API Setup.',
        }),
        ('Rate Limiting', {
            'fields': ['send_delay_seconds'],
        }),
        ('Audit', {
            'fields': ['updated_by', 'updated_at'],
            'classes': ['collapse'],
        }),
    ]
    readonly_fields = ['updated_at']

    def has_add_permission(self, request):
        return not WhatsAppSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

    def changelist_view(self, request, extra_context=None):
        obj, _ = WhatsAppSettings.objects.get_or_create(pk=1)
        return self.change_view(request, str(obj.pk), extra_context=extra_context)


admin_site.register(WhatsAppSettings, WhatsAppSettingsAdmin)


class WaitlistEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'feature_slug', 'event', 'created_at')
    list_filter = ('feature_slug', 'created_at')
    search_fields = ('user__email', 'user__name', 'feature_slug')
    readonly_fields = ('user', 'feature_slug', 'event', 'created_at')
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False


admin_site.register(WaitlistEntry, WaitlistEntryAdmin)
