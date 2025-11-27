"""
URL configuration for registry_backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.common.views import health_check, log_to_cloudwatch_endpoint

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health', health_check, name='health'),
    path('api/health', health_check, name='api-health'),
    path('api/logs/cloudwatch/', log_to_cloudwatch_endpoint, name='cloudwatch-log'),
    path('api/auth/', include('apps.users.urls')),
    path('api/events/', include('apps.events.urls')),
    path('api/items/', include('apps.items.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/registry/', include('apps.events.public_urls')),
    path('api/payments/', include('apps.orders.payment_urls')),
]

# Serve static files in production (if not using S3/CDN)
if not settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
elif settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

