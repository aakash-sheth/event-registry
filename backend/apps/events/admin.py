from django.contrib import admin
from apps.users.admin import admin_site
from .models import Event, Guest, RSVP, InvitePage, SubEvent, GuestSubEventInvite, MessageTemplate


class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'host', 'event_type', 'date', 'is_public', 'created_at')
    list_filter = ('event_type', 'is_public', 'created_at')
    search_fields = ('title', 'slug', 'city')
    readonly_fields = ('created_at', 'updated_at')


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


# Register with custom admin site
admin_site.register(Event, EventAdmin)
admin_site.register(Guest, GuestAdmin)
admin_site.register(RSVP, RSVPAdmin)
admin_site.register(InvitePage, InvitePageAdmin)
admin_site.register(SubEvent, SubEventAdmin)
admin_site.register(GuestSubEventInvite, GuestSubEventInviteAdmin)
admin_site.register(MessageTemplate, MessageTemplateAdmin)

