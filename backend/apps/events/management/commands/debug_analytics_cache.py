"""
Debug command to check analytics cache status
Usage: python manage.py debug_analytics_cache [--watch] [--interval SECONDS]
"""
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.conf import settings
from apps.events.models import Guest, Event
import json
import time
from datetime import datetime


class Command(BaseCommand):
    help = 'Monitor analytics cache to see what views are being tracked'

    def add_arguments(self, parser):
        parser.add_argument(
            '--watch',
            action='store_true',
            help='Watch mode: continuously monitor cache and update every few seconds'
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=5,
            help='Update interval in seconds for watch mode (default: 5)'
        )
        parser.add_argument(
            '--detailed',
            action='store_true',
            help='Show detailed information for each tracked view'
        )

    def handle(self, *args, **options):
        cache_prefix = getattr(settings, 'ANALYTICS_BATCH_CACHE_PREFIX', 'analytics_pending')
        tracking_key = f"{cache_prefix}_keys"
        
        if options['watch']:
            self.watch_mode(cache_prefix, tracking_key, options['interval'], options['detailed'])
        else:
            self.show_status(cache_prefix, tracking_key, options['detailed'])
    
    def show_status(self, cache_prefix, tracking_key, detailed=False):
        """Show current cache status"""
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("ANALYTICS CACHE MONITOR"))
        self.stdout.write("=" * 80)
        self.stdout.write()
        
        # Check cache backend
        cache_backend = settings.CACHES['default']['BACKEND']
        self.stdout.write(f"Cache Backend: {cache_backend}")
        self.stdout.write(f"Cache Prefix: {cache_prefix}")
        self.stdout.write(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.stdout.write()
        
        # Get tracked keys
        tracked_keys = cache.get(tracking_key, [])
        total_keys = len(tracked_keys) if tracked_keys else 0
        
        self.stdout.write(self.style.SUCCESS(f"📊 Summary"))
        self.stdout.write("-" * 80)
        self.stdout.write(f"Tracking Key: {tracking_key}")
        self.stdout.write(f"Total Pending Views: {total_keys}")
        self.stdout.write()
        
        if total_keys == 0:
            self.stdout.write(self.style.WARNING("⚠️  No tracked views in cache"))
            self.stdout.write()
            self.stdout.write("Possible reasons:")
            self.stdout.write("  1. No page views have been collected yet")
            self.stdout.write("  2. Cache was cleared")
            self.stdout.write("  3. Batch processing already ran and cleared the keys")
            self.stdout.write()
            self.stdout.write("💡 Try visiting a page with a guest token to generate a view")
            return
        
        # Group by event and view type
        invite_count = 0
        rsvp_count = 0
        event_counts = {}
        guest_counts = {}
        
        for key in tracked_keys:
            value = cache.get(key)
            if value:
                try:
                    view_data = json.loads(value)
                    view_type = view_data.get('view_type', 'unknown')
                    event_id = view_data.get('event_id')
                    guest_id = view_data.get('guest_id')
                    
                    if view_type == 'invite':
                        invite_count += 1
                    elif view_type == 'rsvp':
                        rsvp_count += 1
                    
                    if event_id:
                        event_counts[event_id] = event_counts.get(event_id, 0) + 1
                    if guest_id:
                        guest_counts[guest_id] = guest_counts.get(guest_id, 0) + 1
                except Exception:
                    pass
        
        self.stdout.write(self.style.SUCCESS("📈 Statistics"))
        self.stdout.write("-" * 80)
        self.stdout.write(f"Invite Views: {invite_count}")
        self.stdout.write(f"RSVP Views: {rsvp_count}")
        self.stdout.write(f"Unique Events: {len(event_counts)}")
        self.stdout.write(f"Unique Guests: {len(guest_counts)}")
        self.stdout.write()
        
        # Show event breakdown
        if event_counts:
            self.stdout.write(self.style.SUCCESS("📋 By Event"))
            self.stdout.write("-" * 80)
            for event_id, count in sorted(event_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
                try:
                    event = Event.objects.get(id=event_id)
                    self.stdout.write(f"  Event {event_id}: {event.title[:50]} - {count} views")
                except Event.DoesNotExist:
                    self.stdout.write(f"  Event {event_id}: (not found) - {count} views")
            if len(event_counts) > 10:
                self.stdout.write(f"  ... and {len(event_counts) - 10} more events")
            self.stdout.write()
        
        # Show detailed view data
        if detailed:
            self.stdout.write(self.style.SUCCESS("🔍 Detailed View Data"))
            self.stdout.write("-" * 80)
            for i, key in enumerate(tracked_keys[:20], 1):
                value = cache.get(key)
                if value:
                    try:
                        view_data = json.loads(value)
                        guest_id = view_data.get('guest_id')
                        event_id = view_data.get('event_id')
                        view_type = view_data.get('view_type')
                        timestamp = view_data.get('timestamp', '')
                        
                        guest_name = "Unknown"
                        event_title = "Unknown"
                        try:
                            if guest_id:
                                guest = Guest.objects.get(id=guest_id)
                                guest_name = guest.name
                            if event_id:
                                event = Event.objects.get(id=event_id)
                                event_title = event.title[:40]
                        except Exception:
                            pass
                        
                        self.stdout.write(f"  {i}. {view_type.upper()} view")
                        self.stdout.write(f"     Guest: {guest_name} (ID: {guest_id})")
                        self.stdout.write(f"     Event: {event_title} (ID: {event_id})")
                        self.stdout.write(f"     Time: {timestamp}")
                        self.stdout.write()
                    except Exception as e:
                        self.stdout.write(f"  {i}. {key} - Error: {str(e)}")
                else:
                    self.stdout.write(f"  {i}. {key} - ⚠️  Value not found")
            
            if len(tracked_keys) > 20:
                self.stdout.write(f"  ... and {len(tracked_keys) - 20} more views")
            self.stdout.write()
        
        self.stdout.write(self.style.SUCCESS("✅ Use 'python manage.py process_analytics_batch --force' to process these views"))
        self.stdout.write(self.style.SUCCESS("💡 Use '--watch' flag to monitor in real-time"))
    
    def watch_mode(self, cache_prefix, tracking_key, interval, detailed):
        """Watch mode: continuously monitor cache"""
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("ANALYTICS CACHE MONITOR - WATCH MODE"))
        self.stdout.write("=" * 80)
        self.stdout.write(f"Update interval: {interval} seconds")
        self.stdout.write("Press Ctrl+C to stop")
        self.stdout.write()
        
        last_count = -1
        
        try:
            while True:
                tracked_keys = cache.get(tracking_key, [])
                current_count = len(tracked_keys) if tracked_keys else 0
                
                # Clear screen (works in most terminals)
                self.stdout.write("\033[2J\033[H")  # ANSI escape codes
                
                self.stdout.write("=" * 80)
                self.stdout.write(self.style.SUCCESS(f"ANALYTICS CACHE MONITOR - {datetime.now().strftime('%H:%M:%S')}"))
                self.stdout.write("=" * 80)
                self.stdout.write()
                
                if current_count != last_count:
                    change = current_count - last_count
                    if change > 0:
                        self.stdout.write(self.style.SUCCESS(f"🆕 {change} new view(s) collected!"))
                    elif change < 0:
                        self.stdout.write(self.style.WARNING(f"📉 {abs(change)} view(s) processed"))
                    last_count = current_count
                
                self.show_status(cache_prefix, tracking_key, detailed)
                
                self.stdout.write()
                self.stdout.write(f"Next update in {interval} seconds... (Ctrl+C to stop)")
                
                time.sleep(interval)
        except KeyboardInterrupt:
            self.stdout.write()
            self.stdout.write(self.style.SUCCESS("✅ Monitoring stopped"))
