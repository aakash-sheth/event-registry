from django.contrib import admin
from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'host', 'event_type', 'date', 'is_public', 'created_at')
    list_filter = ('event_type', 'is_public', 'created_at')
    search_fields = ('title', 'slug', 'city')
    readonly_fields = ('created_at', 'updated_at')

