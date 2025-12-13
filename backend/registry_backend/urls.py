"""
URL configuration for registry_backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.common.views import health_check, log_to_cloudwatch_endpoint, admin_analytics
from apps.users.admin import admin_site

urlpatterns = [
    path('admin/', admin_site.urls),  # Use custom admin site with better error messages
    path('health', health_check, name='health'),
    path('api/health', health_check, name='api-health'),
    path('api/logs/cloudwatch/', log_to_cloudwatch_endpoint, name='cloudwatch-log'),
    path('api/admin/analytics/', admin_analytics, name='admin-analytics'),
    path('api/auth/', include('apps.users.urls')),
    path('api/events/', include('apps.events.urls')),
    path('api/items/', include('apps.items.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/registry/', include('apps.events.public_urls')),
    path('api/payments/', include('apps.orders.payment_urls')),
]

# WhiteNoise handles static files in production, so we don't need static() helper
# Only serve media files in development (production should use S3)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

