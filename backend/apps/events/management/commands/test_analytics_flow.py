"""
Test command to verify analytics collection and processing flow
Usage: python manage.py test_analytics_flow [--event-id EVENT_ID] [--guest-token TOKEN]
"""
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.conf import settings
from apps.events.models import Guest, Event, InvitePageView, RSVPPageView
from apps.events.tasks import collect_page_view, process_analytics_batch
import json


class Command(BaseCommand):
    help = 'Test the complete analytics flow: collection -> cache -> processing -> database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--event-id',
            type=int,
            help='Event ID to test with'
        )
        parser.add_argument(
            '--guest-token',
            type=str,
            help='Guest token to test with'
        )

    def handle(self, *args, **options):
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("TESTING ANALYTICS FLOW"))
        self.stdout.write("=" * 80)
        self.stdout.write()
        
        # Step 1: Find a test guest
        event_id = options.get('event_id')
        guest_token = options.get('guest_token')
        
        if not event_id or not guest_token:
            # Try to find a guest automatically
            guest = Guest.objects.filter(is_removed=False).first()
            if not guest:
                self.stdout.write(self.style.ERROR("❌ No guests found. Please create a guest first."))
                return
            
            event_id = guest.event_id
            guest_token = guest.guest_token
            self.stdout.write(f"Using guest: {guest.name} (ID: {guest.id})")
            self.stdout.write(f"Event ID: {event_id}, Guest Token: {guest_token[:8]}...")
        else:
            try:
                guest = Guest.objects.get(guest_token=guest_token, is_removed=False)
                self.stdout.write(f"Using guest: {guest.name} (ID: {guest.id})")
            except Guest.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"❌ Guest not found with token: {guest_token[:8]}..."))
                return
        
        self.stdout.write()
        
        # Step 2: Check current state
        self.stdout.write(self.style.SUCCESS("Step 1: Current State"))
        self.stdout.write("-" * 80)
        invite_count_before = InvitePageView.objects.filter(guest=guest).count()
        rsvp_count_before = RSVPPageView.objects.filter(guest=guest).count()
        self.stdout.write(f"Current InvitePageView count: {invite_count_before}")
        self.stdout.write(f"Current RSVPPageView count: {rsvp_count_before}")
        self.stdout.write()
        
        # Step 3: Collect a view
        self.stdout.write(self.style.SUCCESS("Step 2: Collecting Page View"))
        self.stdout.write("-" * 80)
        result = collect_page_view(guest_token, event_id, view_type='invite')
        if result:
            self.stdout.write(self.style.SUCCESS("✅ View collected successfully"))
        else:
            self.stdout.write(self.style.ERROR("❌ Failed to collect view"))
            return
        self.stdout.write()
        
        # Step 4: Check cache
        self.stdout.write(self.style.SUCCESS("Step 3: Checking Cache"))
        self.stdout.write("-" * 80)
        cache_prefix = getattr(settings, 'ANALYTICS_BATCH_CACHE_PREFIX', 'analytics_pending')
        tracking_key = f"{cache_prefix}_keys"
        tracked_keys = cache.get(tracking_key, [])
        self.stdout.write(f"Tracked keys in cache: {len(tracked_keys)}")
        if tracked_keys:
            for key in tracked_keys[:3]:
                value = cache.get(key)
                if value:
                    view_data = json.loads(value)
                    self.stdout.write(f"  - {key}")
                    self.stdout.write(f"    Guest ID: {view_data.get('guest_id')}, "
                                    f"Event ID: {view_data.get('event_id')}, "
                                    f"Type: {view_data.get('view_type')}")
        self.stdout.write()
        
        # Step 5: Process batch
        self.stdout.write(self.style.SUCCESS("Step 4: Processing Batch"))
        self.stdout.write("-" * 80)
        try:
            batch_run = process_analytics_batch()
            if batch_run:
                if batch_run.status == 'completed':
                    self.stdout.write(self.style.SUCCESS(f"✅ Batch processed successfully"))
                    self.stdout.write(f"   Views collected: {batch_run.views_collected}")
                    self.stdout.write(f"   Views deduplicated: {batch_run.views_deduplicated}")
                    self.stdout.write(f"   Views inserted: {batch_run.views_inserted}")
                elif batch_run.status == 'failed':
                    self.stdout.write(self.style.ERROR(f"❌ Batch processing failed"))
                    self.stdout.write(f"   Error: {batch_run.error_message}")
                else:
                    self.stdout.write(self.style.WARNING(f"⚠️  Batch status: {batch_run.status}"))
            else:
                self.stdout.write(self.style.ERROR("❌ Batch processing returned None"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Error processing batch: {str(e)}"))
            import traceback
            self.stdout.write(traceback.format_exc())
            return
        self.stdout.write()
        
        # Step 6: Check final state
        self.stdout.write(self.style.SUCCESS("Step 5: Final State"))
        self.stdout.write("-" * 80)
        invite_count_after = InvitePageView.objects.filter(guest=guest).count()
        rsvp_count_after = RSVPPageView.objects.filter(guest=guest).count()
        self.stdout.write(f"Final InvitePageView count: {invite_count_after}")
        self.stdout.write(f"Final RSVPPageView count: {rsvp_count_after}")
        
        if invite_count_after > invite_count_before:
            self.stdout.write(self.style.SUCCESS(f"✅ SUCCESS! Invite view was inserted (increased by {invite_count_after - invite_count_before})"))
        else:
            self.stdout.write(self.style.ERROR(f"❌ FAILED! Invite view was not inserted"))
        
        self.stdout.write()
        self.stdout.write("=" * 80)
