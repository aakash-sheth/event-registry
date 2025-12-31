from django.contrib import admin
from apps.users.admin import admin_site
from .models import RegistryItem


class RegistryItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'event', 'price_inr', 'qty_total', 'qty_purchased', 'status', 'item_type', 'created_at')
    list_filter = ('status', 'item_type', 'event', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')


# Register with custom admin site
admin_site.register(RegistryItem, RegistryItemAdmin)

