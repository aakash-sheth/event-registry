from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventViewSet, create_rsvp, get_rsvp, check_phone_for_rsvp, get_guest_by_token,
    InvitePageViewSet, PublicInviteViewSet, upload_image,
    SubEventViewSet, GuestInviteViewSet, MessageTemplateViewSet,
    InvitePageLayoutViewSet,
    GreetingCardSampleViewSet, upload_greeting_card_image,
    whatsapp_template_preview, whatsapp_template_duplicate,
    whatsapp_template_archive, whatsapp_template_activate,
    whatsapp_template_increment_usage, whatsapp_template_set_default,
    get_event_impact, get_overall_impact,
    invite_page_by_event, attribution_redirect,
    RecordRegistryView,
    MessageCampaignViewSet, whatsapp_webhook, whatsapp_status, whatsapp_test_send,
    booking_schedule_detail, booking_slots_collection, booking_slot_detail,
    booking_slots_reorder, public_booking_calendar, public_booking_slots_by_date,
    create_slot_booking, host_slot_bookings, host_update_slot_booking,
    host_move_slot_booking, host_override_slot_booking_capacity,
)

router = DefaultRouter()
router.register(r'', EventViewSet, basename='event')
router.register(r'sub-events', SubEventViewSet, basename='sub-event')
router.register(r'guest-invites', GuestInviteViewSet, basename='guest-invite')

urlpatterns = [
    # Put custom paths BEFORE router.urls so they take precedence
    # Invite page layouts (Page Layout Studio) - list/create and retrieve/update/delete
    path('invite-page-layouts/', InvitePageLayoutViewSet.as_view({'get': 'list', 'post': 'create'}), name='invite-page-layouts-list'),
    path('invite-page-layouts/<int:id>/', InvitePageLayoutViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='invite-page-layout-detail'),
    # Greeting card samples (staff-curated card backgrounds)
    path('greeting-card-samples/upload-image/', upload_greeting_card_image, name='greeting-card-upload-image'),
    path('greeting-card-samples/', GreetingCardSampleViewSet.as_view({'get': 'list', 'post': 'create'}), name='greeting-card-samples-list'),
    path('greeting-card-samples/<int:pk>/', GreetingCardSampleViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='greeting-card-sample-detail'),
    path('q/<str:token>/', attribution_redirect, name='attribution-redirect'),
    # Impact endpoints - must be before routes with <int:id> to avoid conflicts
    path('impact/overall/', get_overall_impact, name='overall-impact'),
    # Invite page routes - must be before other <int:id> routes to avoid conflicts
    path('<int:event_id>/invite/', invite_page_by_event, name='event-invite'),
    path('<int:id>/guests/import/', EventViewSet.as_view({'post': 'import_guests'}), name='event-guests-import'),
    path('<int:id>/guests/import-json/', EventViewSet.as_view({'post': 'import_guests_json'}), name='event-guests-import-json'),
    path('<int:id>/guests/<int:guest_id>/', EventViewSet.as_view({'put': 'update_guest', 'patch': 'update_guest', 'delete': 'delete_guest'}), name='event-guest-update'),
    path('<int:id>/orders/', EventViewSet.as_view({'get': 'orders'}), name='event-orders'),
    path('<int:id>/design/', EventViewSet.as_view({'put': 'update_design', 'patch': 'update_design'}), name='event-design'),
    path('<int:id>/impact/', get_event_impact, name='event-impact'),
    path('<int:event_id>/rsvp/', create_rsvp, name='event-rsvp'),
    path('<int:event_id>/rsvp/check/', get_rsvp, name='event-rsvp-check'),
    path('<int:event_id>/rsvp/check/phone/', check_phone_for_rsvp, name='event-rsvp-check-phone'),
    path('<int:event_id>/rsvp/guest-by-token/', get_guest_by_token, name='event-rsvp-guest-by-token'),
    # Slot booking endpoints
    path('<int:event_id>/booking-schedule/', booking_schedule_detail, name='booking-schedule-detail'),
    path('<int:event_id>/booking-slots/', booking_slots_collection, name='booking-slots-collection'),
    path('<int:event_id>/booking-slots/reorder/', booking_slots_reorder, name='booking-slots-reorder'),
    path('<int:event_id>/booking-slots/<int:slot_id>/', booking_slot_detail, name='booking-slot-detail'),
    path('public/<slug:slug>/booking-calendar/', public_booking_calendar, name='public-booking-calendar'),
    path('public/<slug:slug>/booking-slots/', public_booking_slots_by_date, name='public-booking-slots'),
    path('<int:event_id>/slot-bookings/', create_slot_booking, name='slot-booking-create'),
    path('<int:event_id>/host-slot-bookings/', host_slot_bookings, name='host-slot-bookings'),
    path('<int:event_id>/host-slot-bookings/<int:booking_id>/', host_update_slot_booking, name='host-slot-booking-update'),
    path('<int:event_id>/host-slot-bookings/<int:booking_id>/move/', host_move_slot_booking, name='host-slot-booking-move'),
    path('<int:event_id>/host-slot-bookings/<int:booking_id>/override-capacity/', host_override_slot_booking_capacity, name='host-slot-booking-override'),
    # Registry view tracking (fire-and-forget, always 204)
    path('registry/<slug:slug>/view/', RecordRegistryView.as_view(), name='registry-page-view'),
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
    path('guest-invites/bulk-assign/', GuestInviteViewSet.as_view({'post': 'bulk_assign_subevents'}), name='guest-invites-bulk-assign'),
    # WhatsApp template endpoints
    # Nested route for list/create (requires event_id in URL)
    path('<int:event_id>/whatsapp-templates/', MessageTemplateViewSet.as_view({'get': 'list', 'post': 'create'}), name='event-whatsapp-templates'),
    # Event-level template endpoints
    path('<int:id>/whatsapp-templates/available-variables/', EventViewSet.as_view({'get': 'get_available_variables'}), name='event-available-variables'),
    path('<int:id>/description-variables/', EventViewSet.as_view({'get': 'description_variables'}), name='event-description-variables'),
    path('<int:id>/whatsapp-preview/', EventViewSet.as_view({'post': 'whatsapp_preview'}), name='event-whatsapp-preview'),
    path('<int:id>/system-default-template/', EventViewSet.as_view({'get': 'get_system_default_template'}), name='event-system-default-template'),
    # Action routes - using standalone view functions for better routing
    path('whatsapp-templates/<int:id>/preview/', whatsapp_template_preview, name='whatsapp-template-preview'),
    path('whatsapp-templates/<int:id>/duplicate/', whatsapp_template_duplicate, name='whatsapp-template-duplicate'),
    path('whatsapp-templates/<int:id>/archive/', whatsapp_template_archive, name='whatsapp-template-archive'),
    path('whatsapp-templates/<int:id>/activate/', whatsapp_template_activate, name='whatsapp-template-activate'),
    path('whatsapp-templates/<int:id>/increment-usage/', whatsapp_template_increment_usage, name='whatsapp-template-increment-usage'),
    path('whatsapp-templates/<int:id>/set-default/', whatsapp_template_set_default, name='whatsapp-template-set-default'),
    # Detail route (must come after action routes)
    path('whatsapp-templates/<int:id>/', MessageTemplateViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}), name='whatsapp-template-detail'),
    # Campaign routes
    path('<int:event_id>/campaigns/',
         MessageCampaignViewSet.as_view({'get': 'list', 'post': 'create'}),
         name='event-campaigns'),
    path('<int:event_id>/campaigns/<int:id>/',
         MessageCampaignViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'}),
         name='event-campaign-detail'),
    path('<int:event_id>/campaigns/<int:id>/launch/',
         MessageCampaignViewSet.as_view({'post': 'launch'}),
         name='event-campaign-launch'),
    path('<int:event_id>/campaigns/<int:id>/cancel/',
         MessageCampaignViewSet.as_view({'post': 'cancel'}),
         name='event-campaign-cancel'),
    path('<int:event_id>/campaigns/<int:id>/duplicate/',
         MessageCampaignViewSet.as_view({'post': 'duplicate'}),
         name='event-campaign-duplicate'),
    path('<int:event_id>/campaigns/<int:id>/report/',
         MessageCampaignViewSet.as_view({'get': 'report'}),
         name='event-campaign-report'),
    path('<int:event_id>/campaigns/<int:id>/preview-recipients/',
         MessageCampaignViewSet.as_view({'get': 'preview_recipients'}),
         name='event-campaign-preview-recipients'),
    # WhatsApp global endpoints
    path('whatsapp/webhook/', whatsapp_webhook, name='whatsapp-webhook'),
    path('whatsapp/status/', whatsapp_status, name='whatsapp-status'),
    path('whatsapp/test-send/', whatsapp_test_send, name='whatsapp-test-send'),
    path('', include(router.urls)),
]
