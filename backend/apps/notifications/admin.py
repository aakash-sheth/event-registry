from django.contrib import admin
from .models import NotificationLog


@admin.register(NotificationLog)
class NotificationLogAdmin(admin.ModelAdmin):
    list_display = ('channel', 'to', 'template', 'status', 'created_at')
    list_filter = ('channel', 'status', 'created_at')
    search_fields = ('to', 'template')
    readonly_fields = ('created_at',)

