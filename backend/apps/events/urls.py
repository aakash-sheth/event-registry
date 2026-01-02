from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventViewSet, create_rsvp, get_rsvp, check_phone_for_rsvp,
    InvitePageViewSet, PublicInviteViewSet, upload_image,
    SubEventViewSet, GuestInviteViewSet, MessageTemplateViewSet,
    whatsapp_template_preview, whatsapp_template_duplicate,
    whatsapp_template_archive, whatsapp_template_activate,
    whatsapp_template_increment_usage
)

router = DefaultRouter()
router.register(r'', EventViewSet, basename='event')
router.register(r'sub-events', SubEventViewSet, basename='sub-event')
router.register(r'guest-invites', GuestInviteViewSet, basename='guest-invite')

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
    # Sub-events endpoints
    path('envelopes/<int:event_id>/sub-events/', SubEventViewSet.as_view({'get': 'list', 'post': 'create'}), name='envelope-sub-events'),
    path('sub-events/<int:id>/', SubEventViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='sub-event-detail'),
    # Guest invite management endpoints
    path('envelopes/<int:event_id>/guests/', GuestInviteViewSet.as_view({'get': 'by_event'}), name='envelope-guests'),
    path('guests/<int:guest_id>/invites/', GuestInviteViewSet.as_view({'put': 'update_guest_invites'}), name='guest-invites-update'),
    # WhatsApp template endpoints
    # Nested route for list/create (requires event_id in URL)
    path('<int:event_id>/whatsapp-templates/', MessageTemplateViewSet.as_view({'get': 'list', 'post': 'create'}), name='event-whatsapp-templates'),
    # Event-level template endpoints
    path('<int:id>/whatsapp-templates/available-variables/', EventViewSet.as_view({'get': 'get_available_variables'}), name='event-available-variables'),
    path('<int:id>/whatsapp-preview/', EventViewSet.as_view({'post': 'whatsapp_preview'}), name='event-whatsapp-preview'),
    path('<int:id>/system-default-template/', EventViewSet.as_view({'get': 'get_system_default_template'}), name='event-system-default-template'),
    # Action routes - using standalone view functions for better routing
    path('whatsapp-templates/<int:id>/preview/', whatsapp_template_preview, name='whatsapp-template-preview'),
    path('whatsapp-templates/<int:id>/duplicate/', whatsapp_template_duplicate, name='whatsapp-template-duplicate'),
    path('whatsapp-templates/<int:id>/archive/', whatsapp_template_archive, name='whatsapp-template-archive'),
    path('whatsapp-templates/<int:id>/activate/', whatsapp_template_activate, name='whatsapp-template-activate'),
    path('whatsapp-templates/<int:id>/increment-usage/', whatsapp_template_increment_usage, name='whatsapp-template-increment-usage'),
    # Detail route (must come after action routes)
    path('whatsapp-templates/<int:id>/', MessageTemplateViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='whatsapp-template-detail'),
    path('', include(router.urls)),
]
