from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EventViewSet, create_rsvp, get_rsvp, check_phone_for_rsvp, InvitePageViewSet, PublicInviteViewSet, upload_image

router = DefaultRouter()
router.register(r'', EventViewSet, basename='event')

urlpatterns = [
    # Put custom paths BEFORE router.urls so they take precedence
    path('<int:id>/guests.csv/', EventViewSet.as_view({'get': 'guests_csv'}), name='event-guests-csv'),
    path('<int:id>/guests/<int:guest_id>/', EventViewSet.as_view({'put': 'update_guest', 'patch': 'update_guest', 'delete': 'delete_guest'}), name='event-guest-update'),
    path('<int:id>/orders/', EventViewSet.as_view({'get': 'orders'}), name='event-orders'),
    path('<int:id>/design/', EventViewSet.as_view({'put': 'update_design', 'patch': 'update_design'}), name='event-design'),
    path('<int:event_id>/rsvp/', create_rsvp, name='event-rsvp'),
    path('<int:event_id>/rsvp/check/', get_rsvp, name='event-rsvp-check'),
    path('<int:event_id>/rsvp/check/phone/', check_phone_for_rsvp, name='event-rsvp-check-phone'),
    # Invite page routes - must be before router.urls
    path('<int:event_id>/invite/', InvitePageViewSet.as_view({'get': 'retrieve', 'post': 'create', 'put': 'update', 'patch': 'partial_update'}), name='event-invite'),
    # Public invite routes
    path('invite/<str:slug>/', PublicInviteViewSet.as_view({'get': 'retrieve'}), name='public-invite'),
    path('invite/<str:slug>/publish/', InvitePageViewSet.as_view({'post': 'publish'}), name='invite-publish'),
    # Image upload endpoint
    path('<int:event_id>/upload-image/', upload_image, name='upload-image'),
    path('', include(router.urls)),
]
