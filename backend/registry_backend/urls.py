"""
URL configuration for registry_backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.users.urls')),
    path('api/events/', include('apps.events.urls')),
    path('api/items/', include('apps.items.urls')),
    path('api/orders/', include('apps.orders.urls')),
    path('api/registry/', include('apps.events.public_urls')),
    path('api/payments/', include('apps.orders.payment_urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

