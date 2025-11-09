from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EventViewSet, create_rsvp

router = DefaultRouter()
router.register(r'', EventViewSet, basename='event')

urlpatterns = [
    # Put custom paths BEFORE router.urls so they take precedence
    path('<int:id>/guests.csv/', EventViewSet.as_view({'get': 'guests_csv'}), name='event-guests-csv'),
    path('<int:id>/guests/<int:guest_id>/', EventViewSet.as_view({'put': 'update_guest', 'patch': 'update_guest', 'delete': 'delete_guest'}), name='event-guest-update'),
    path('<int:id>/orders/', EventViewSet.as_view({'get': 'orders'}), name='event-orders'),
    path('<int:id>/design/', EventViewSet.as_view({'put': 'update_design', 'patch': 'update_design'}), name='event-design'),
    path('<int:event_id>/rsvp/', create_rsvp, name='event-rsvp'),
    path('', include(router.urls)),
]
