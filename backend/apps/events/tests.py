"""
Tests for events views fixes
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.events.models import Event, Guest, RSVP, InvitePage, WhatsAppTemplate, SubEvent

User = get_user_model()


class EventViewSetGuestsTestCase(TestCase):
    """Test fix A: guests() GET properly separates removed RSVPs"""
    
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.client.force_authenticate(user=self.host)
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True
        )
    
    def test_removed_rsvp_without_guest_appears_in_removed_guests(self):
        """Test that removed RSVP with guest=None appears in removed_guests"""
        # Create a removed RSVP without a guest
        removed_rsvp = RSVP.objects.create(
            event=self.event,
            name='Other Guest',
            phone='+911234567890',
            will_attend='yes',
            is_removed=True,
            guest=None
        )
        
        # Create an active RSVP without a guest
        active_rsvp = RSVP.objects.create(
            event=self.event,
            name='Active Guest',
            phone='+919876543210',
            will_attend='yes',
            is_removed=False,
            guest=None
        )
        
        # GET guests endpoint (guests is an action on EventViewSet)
        response = self.client.get(f'/api/events/{self.event.id}/guests/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Check that removed RSVP appears in removed_guests
        removed_guests = data.get('removed_guests', [])
        removed_guest_ids = [g['id'] for g in removed_guests]
        self.assertIn(removed_rsvp.id, removed_guest_ids)
        
        # Check that active RSVP appears in other_guests
        other_guests = data.get('other_guests', [])
        other_guest_ids = [g['id'] for g in other_guests]
        self.assertIn(active_rsvp.id, other_guest_ids)
        
        # Check that removed RSVP does NOT appear in other_guests
        self.assertNotIn(removed_rsvp.id, other_guest_ids)


class WhatsAppTemplateViewSetTestCase(TestCase):
    """Test fix B: perform_update() handles missing name in PATCH"""
    
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.client.force_authenticate(user=self.host)
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True
        )
        self.template = WhatsAppTemplate.objects.create(
            event=self.event,
            name='Original Template',
            message_type='TEXT',
            template_text='Hello {name}!'
        )
    
    def test_patch_without_name_does_not_crash(self):
        """Test that PATCH without name field doesn't crash"""
        # PATCH without name field (URL pattern is /api/events/whatsapp-templates/{id}/)
        response = self.client.patch(
            f'/api/events/whatsapp-templates/{self.template.id}/',
            {'template_text': 'Updated text'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.template.refresh_from_db()
        self.assertEqual(self.template.name, 'Original Template')  # Should keep original name
        self.assertEqual(self.template.template_text, 'Updated text')
    
    def test_patch_without_name_still_checks_duplicates(self):
        """Test that duplicate name check still works when name not provided"""
        # Create another template
        other_template = WhatsAppTemplate.objects.create(
            event=self.event,
            name='Other Template',
            message_type='TEXT',
            template_text='Other text'
        )
        
        # Try to PATCH without name - should use existing name and check duplicates
        # This should succeed since we're using the same template's existing name
        response = self.client.patch(
            f'/api/events/whatsapp-templates/{self.template.id}/',
            {'template_text': 'Updated text'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class PublicInviteViewSetTestCase(TestCase):
    """Test fix D: PublicInviteViewSet does NOT auto-publish unpublished invite pages"""
    
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True
        )
    
    def test_unpublished_invite_page_returns_404(self):
        """Test that accessing unpublished invite page returns 404, not auto-publish"""
        # Create unpublished invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=False
        )
        
        # Try to access it (public invite endpoint)
        response = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        
        # Should return 404, not auto-publish
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
        # Verify it's still unpublished
        invite_page.refresh_from_db()
        self.assertFalse(invite_page.is_published)
    
    def test_published_invite_page_works(self):
        """Test that published invite page still works"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True
        )
        
        # Try to access it (public invite endpoint)
        response = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        
        # Should succeed
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class CreateRSVPEnvelopeTestCase(TestCase):
    """Test fix E: create_rsvp() ENVELOPE returns 201 if any new RSVP created, else 200"""
    
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True,
            event_structure='ENVELOPE',
            rsvp_mode='PER_SUBEVENT',
            has_rsvp=True
        )
        self.sub_event1 = SubEvent.objects.create(
            event=self.event,
            title='Sub Event 1',
            start_at=timezone.now() + timedelta(days=1),
            rsvp_enabled=True
        )
        self.sub_event2 = SubEvent.objects.create(
            event=self.event,
            title='Sub Event 2',
            start_at=timezone.now() + timedelta(days=2),
            rsvp_enabled=True
        )
    
    def test_new_rsvp_returns_201(self):
        """Test that creating new RSVPs returns 201"""
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'yes',
                'selectedSubEventIds': [self.sub_event1.id, self.sub_event2.id]
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_update_existing_rsvp_returns_200(self):
        """Test that updating existing RSVPs returns 200"""
        # Create existing RSVPs
        RSVP.objects.create(
            event=self.event,
            sub_event=self.sub_event1,
            name='Test Guest',
            phone='+911234567890',
            will_attend='yes'
        )
        RSVP.objects.create(
            event=self.event,
            sub_event=self.sub_event2,
            name='Test Guest',
            phone='+911234567890',
            will_attend='yes'
        )
        
        # Update them
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'no',
                'selectedSubEventIds': [self.sub_event1.id, self.sub_event2.id]
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_mixed_new_and_existing_returns_201(self):
        """Test that if any new RSVP is created, return 201 even if some exist"""
        # Create one existing RSVP
        RSVP.objects.create(
            event=self.event,
            sub_event=self.sub_event1,
            name='Test Guest',
            phone='+911234567890',
            will_attend='yes'
        )
        
        # Create RSVP for both sub-events (one new, one existing)
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'yes',
                'selectedSubEventIds': [self.sub_event1.id, self.sub_event2.id]
            },
            format='json'
        )
        
        # Should return 201 because at least one new RSVP was created
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

