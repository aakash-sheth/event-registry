from django.contrib import admin
from apps.users.admin import admin_site
from .models import NotificationLog, NotificationPreference, NotificationQueue


class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ('channel', 'to', 'template', 'status', 'created_at')
    list_filter = ('channel', 'status', 'created_at')
    search_fields = ('to', 'template')
    readonly_fields = ('created_at',)


class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ('user', 'rsvp_new', 'gift_received', 'marketing_emails', 'updated_at')
    list_filter = ('rsvp_new', 'gift_received', 'marketing_emails')
    search_fields = ('user__email', 'user__name')
    readonly_fields = ('unsubscribe_token', 'updated_at')


class NotificationQueueAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_type', 'created_at', 'sent_at')
    list_filter = ('notification_type', 'sent_at')
    search_fields = ('user__email',)
    readonly_fields = ('created_at',)


admin_site.register(NotificationLog, NotificationLogAdmin)
admin_site.register(NotificationPreference, NotificationPreferenceAdmin)
admin_site.register(NotificationQueue, NotificationQueueAdmin)
