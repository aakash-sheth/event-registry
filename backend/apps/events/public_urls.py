from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PublicEventViewSet, create_rsvp

router = DefaultRouter()
router.register(r'', PublicEventViewSet, basename='public-event')

urlpatterns = [
    path('', include(router.urls)),
    path('<slug:slug>/items', PublicEventViewSet.as_view({'get': 'items'}), name='public-event-items'),
]

