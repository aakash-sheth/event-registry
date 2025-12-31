from django.contrib import admin
from apps.users.admin import admin_site
from .models import NotificationLog


class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ('channel', 'to', 'template', 'status', 'created_at')
    list_filter = ('channel', 'status', 'created_at')
    search_fields = ('to', 'template')
    readonly_fields = ('created_at',)


# Register with custom admin site
admin_site.register(NotificationLog, NotificationLogAdmin)

