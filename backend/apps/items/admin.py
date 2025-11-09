from django.contrib import admin
from .models import RegistryItem


@admin.register(RegistryItem)
class RegistryItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'event', 'price_inr', 'qty_total', 'qty_purchased', 'status', 'created_at')
    list_filter = ('status', 'event', 'created_at')
    search_fields = ('name', 'description')
    readonly_fields = ('created_at', 'updated_at')

