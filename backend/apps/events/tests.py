"""
Tests for events views fixes
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.events.models import Event, Guest, RSVP, InvitePage, MessageTemplate, SubEvent, GuestSubEventInvite
from django.core.cache import cache

User = get_user_model()


class EventViewSetGuestsTestCase(TestCase):
    """Test fix A: guests() GET properly separates removed RSVPs"""
    
    def setUp(self):
        cache.clear()  # Clear cache before each test
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


class MessageTemplateViewSetTestCase(TestCase):
    """Test fix B: perform_update() handles missing name in PATCH"""
    
    def setUp(self):
        cache.clear()  # Clear cache before each test
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.client.force_authenticate(user=self.host)
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True
        )
        self.template = MessageTemplate.objects.create(
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
        other_template = MessageTemplate.objects.create(
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
        cache.clear()  # Clear cache before each test
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
        cache.clear()  # Clear cache before each test
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

        # Create MAIN RSVP first (so the next call is a pure update, not partially creating new rows)
        RSVP.objects.create(
            event=self.event,
            sub_event=None,
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

    def test_no_selection_allowed_for_no_applies_to_all(self):
        """PER_SUBEVENT: empty selectedSubEventIds should still create/update MAIN RSVP (sub_event=NULL) only"""
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'no',
                'selectedSubEventIds': []  # explicitly empty
            },
            format='json'
        )

        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(isinstance(response.data, list))
        # Should return only MAIN RSVP
        self.assertEqual(len(response.data), 1)
        self.assertIsNone(response.data[0].get('sub_event'))
        self.assertIsNone(response.data[0].get('sub_event_id'))

    def test_selected_subevents_creates_main_plus_selected(self):
        """PER_SUBEVENT: selecting sub-events creates/updates MAIN RSVP plus selected sub-event RSVPs"""
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'yes',
                'selectedSubEventIds': [self.sub_event1.id]
            },
            format='json'
        )

        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(isinstance(response.data, list))
        # main + 1 selected sub-event
        self.assertEqual(len(response.data), 2)
    
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


class CreateRSVPEnvelopeOneTapAllTestCase(TestCase):
    """ONE_TAP_ALL should allow MAIN RSVP even when guest has no sub-event invites"""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.host = User.objects.create_user(email='host2@test.com', name='Test Host 2')
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event-one-tap',
            title='Test Event One Tap',
            is_public=True,
            event_structure='ENVELOPE',
            rsvp_mode='ONE_TAP_ALL',
            has_rsvp=True
        )
        self.sub_event1 = SubEvent.objects.create(
            event=self.event,
            title='Sub Event 1',
            start_at=timezone.now() + timedelta(days=1),
            rsvp_enabled=True
        )
        self.guest = Guest.objects.create(
            event=self.event,
            name='Guest A',
            phone='+911234567890',
            is_removed=False
        )

    def test_no_invites_still_allows_main_rsvp(self):
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Guest A',
                'phone': '+911234567890',
                'will_attend': 'yes',
            },
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(isinstance(response.data, list))
        self.assertEqual(len(response.data), 1)
        self.assertIsNone(response.data[0].get('sub_event'))
        self.assertIsNone(response.data[0].get('sub_event_id'))

    def test_with_invite_creates_main_plus_subevent(self):
        GuestSubEventInvite.objects.create(guest=self.guest, sub_event=self.sub_event1)
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Guest A',
                'phone': '+911234567890',
                'will_attend': 'yes',
            },
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(isinstance(response.data, list))
        # main + 1 allowed sub-event
        self.assertEqual(len(response.data), 2)
        self.assertIsNone(response.data[0].get('sub_event'))
        self.assertEqual(response.data[1].get('sub_event_id'), self.sub_event1.id)


class InvitePageCacheTestCase(TestCase):
    """Test cache functionality for invite pages"""
    
    def setUp(self):
        cache.clear()  # Clear cache before each test
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True,
            event_structure='SIMPLE'
        )
    
    def get_cache_key(self, slug):
        """Helper to get cache key"""
        return f'invite_page:{slug}'
    
    def test_cache_hit_for_published_page(self):
        """Test that published invite page is cached and subsequent requests hit cache"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True,
            config={'themeId': 'classic-noir'}
        )
        
        cache_key = self.get_cache_key(invite_page.slug)
        
        # First request - should be cache MISS
        self.assertIsNone(cache.get(cache_key))
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Verify cache was set
        cached_data = cache.get(cache_key)
        self.assertIsNotNone(cached_data, "Cache should be set after first request")
        
        # Second request - should be cache HIT (no database queries)
        with self.assertNumQueries(0):
            response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Verify responses match
        self.assertEqual(response1.json(), response2.json())
    
    def test_cache_miss_for_unpublished_page(self):
        """Test that unpublished invite pages are never cached"""
        # Create unpublished invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=False
        )
        
        cache_key = self.get_cache_key(invite_page.slug)
        
        # Make multiple requests
        for _ in range(3):
            response = self.client.get(f'/api/events/invite/{invite_page.slug}/')
            # Should return 404 (unpublished)
            self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
            # Cache should never be set
            self.assertIsNone(cache.get(cache_key))
    
    def test_cache_bypass_for_guest_token(self):
        """Test that guest token requests bypass cache"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True
        )
        
        # Create guest with token
        guest = Guest.objects.create(
            event=self.event,
            name='Test Guest',
            phone='+911234567890',
            guest_token='test-token-123'
        )
        
        cache_key = self.get_cache_key(invite_page.slug)
        
        # Make request with guest token
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/?g=test-token-123')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Cache should not be set for guest token requests
        # Public cache should not exist
        self.assertIsNone(cache.get(cache_key))
        
        # Make another request with guest token - should hit database (not cached)
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/?g=test-token-123')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Both should have guest context
        self.assertIn('guest_context', response1.json())
        self.assertIn('guest_context', response2.json())
    
    def test_cache_invalidation_on_update(self):
        """Test that cache is invalidated when invite page is updated"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True,
            config={'themeId': 'classic-noir'}
        )
        
        cache_key = self.get_cache_key(invite_page.slug)
        
        # First request - cache MISS, then cached
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(cache.get(cache_key))
        
        # Update invite page config
        invite_page.config = {'themeId': 'modern-minimal'}
        invite_page.save(update_fields=['config', 'updated_at'])
        
        # Cache should be invalidated
        self.assertIsNone(cache.get(cache_key), "Cache should be invalidated after update")
        
        # Next request should be cache MISS (not HIT)
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Verify new config is in response
        self.assertNotEqual(response1.json(), response2.json())
    
    def test_cache_invalidation_on_publish(self):
        """Test that cache is invalidated when invite page is published/unpublished"""
        # Create unpublished invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=False
        )
        
        cache_key = self.get_cache_key(invite_page.slug)
        
        # Publish it
        invite_page.is_published = True
        invite_page.save(update_fields=['is_published', 'updated_at'])
        
        # Cache should be invalidated (cleared)
        self.assertIsNone(cache.get(cache_key))
        
        # First request after publish - cache MISS
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Second request - cache HIT
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(response1.json(), response2.json())
        
        # Unpublish it
        invite_page.is_published = False
        invite_page.save(update_fields=['is_published', 'updated_at'])
        
        # Cache should be invalidated
        self.assertIsNone(cache.get(cache_key))
    
    def test_cache_invalidation_on_subevent_change(self):
        """Test that cache is invalidated when sub-events change"""
        # Create published invite page with ENVELOPE event
        self.event.event_structure = 'ENVELOPE'
        self.event.save(update_fields=['event_structure'])
        
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True
        )
        
        cache_key = self.get_cache_key(invite_page.slug)
        
        # First request - cache MISS, then cached
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(cache.get(cache_key))
        
        # Add sub-event
        sub_event = SubEvent.objects.create(
            event=self.event,
            title='Test Sub Event',
            start_at=timezone.now() + timedelta(days=1),
            is_public_visible=True
        )
        
        # Cache should be invalidated (via signal)
        self.assertIsNone(cache.get(cache_key), "Cache should be invalidated after sub-event change")
        
        # Next request should be cache MISS
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
    
    def test_cache_ttl_expiration(self):
        """Test that cache TTL works correctly"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True
        )
        
        cache_key = self.get_cache_key(invite_page.slug)
        
        # First request - cache MISS, then cached with TTL
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(cache.get(cache_key))
        
        # Manually delete cache (simulating TTL expiration)
        cache.delete(cache_key)
        self.assertIsNone(cache.get(cache_key))
        
        # Next request should be cache MISS (cache expired)
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Cache should be set again
        self.assertIsNotNone(cache.get(cache_key))
    
    def test_query_optimization_with_only(self):
        """Test that query optimization with only() loads only required fields"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True,
            config={'themeId': 'classic-noir'}
        )
        
        # Make request and count queries
        # Should use optimized query with only() - single query for InvitePage with select_related
        # Note: May have additional queries for sub-events if event_structure is ENVELOPE
        with self.assertNumQueries(1):  # Single query for InvitePage with select_related (SIMPLE event)
            response = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        
        # Verify response has expected fields (from serializer)
        self.assertIn('id', data)
        self.assertIn('slug', data)
        self.assertIn('config', data)
        self.assertIn('event_structure', data)
        self.assertIn('rsvp_mode', data)
        
        # Verify that Event fields are accessible (proving select_related worked)
        self.assertEqual(data['event_structure'], 'SIMPLE')
        self.assertEqual(data['rsvp_mode'], 'ONE_TAP_ALL')

