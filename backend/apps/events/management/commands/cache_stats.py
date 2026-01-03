"""
Django management command to display cache statistics
Usage: python manage.py cache_stats [--detailed] [--clear]
"""
from django.core.management.base import BaseCommand
from django.core.cache import cache
from django.conf import settings
from apps.events.models import InvitePage
import sys


class Command(BaseCommand):
    help = 'Display cache statistics for invite pages'

    def add_arguments(self, parser):
        parser.add_argument(
            '--detailed',
            action='store_true',
            help='Show detailed cache information'
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all cache entries'
        )

    def handle(self, *args, **options):
        if options['clear']:
            cache.clear()
            self.stdout.write(self.style.SUCCESS('✅ Cache cleared successfully'))
            return

        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("CACHE STATISTICS"))
        self.stdout.write("=" * 80)
        self.stdout.write()

        # Get cache backend info
        cache_backend = settings.CACHES['default']['BACKEND']
        self.stdout.write(f"Cache Backend: {cache_backend}")
        self.stdout.write()

        # For LocMemCache, we can get some stats
        if 'LocMemCache' in cache_backend:
            self.stdout.write(self.style.WARNING("📊 LocMemCache Statistics"))
            self.stdout.write("-" * 80)
            
            # Test cache operations
            test_key = '__cache_stats_test__'
            test_value = 'test'
            
            try:
                cache.set(test_key, test_value, 60)
                retrieved = cache.get(test_key)
                if retrieved == test_value:
                    self.stdout.write(self.style.SUCCESS("✅ Cache is operational"))
                else:
                    self.stdout.write(self.style.ERROR("❌ Cache retrieval failed"))
                cache.delete(test_key)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"❌ Cache error: {str(e)}"))
                return
            
            self.stdout.write()

        # Count cached invite pages
        self.stdout.write(self.style.WARNING("📋 Invite Page Cache Entries"))
        self.stdout.write("-" * 80)
        
        # Get all published invite pages
        published_pages = InvitePage.objects.filter(is_published=True).values_list('slug', flat=True)
        cached_count = 0
        not_cached_count = 0
        
        for slug in published_pages:
            cache_key = f'invite_page:{slug}'
            if cache.get(cache_key) is not None:
                cached_count += 1
            else:
                not_cached_count += 1
        
        total_published = len(published_pages)
        self.stdout.write(f"Total Published Pages: {total_published}")
        self.stdout.write(f"Cached Pages: {cached_count}")
        self.stdout.write(f"Not Cached Pages: {not_cached_count}")
        
        if total_published > 0:
            cache_coverage = (cached_count / total_published) * 100
            self.stdout.write(f"Cache Coverage: {cache_coverage:.1f}%")
        
        self.stdout.write()

        # Detailed information
        if options['detailed']:
            self.stdout.write(self.style.WARNING("🔍 Detailed Cache Information"))
            self.stdout.write("-" * 80)
            
            if cached_count > 0:
                self.stdout.write("Cached Pages:")
                for slug in published_pages:
                    cache_key = f'invite_page:{slug}'
                    if cache.get(cache_key) is not None:
                        self.stdout.write(f"  ✅ {slug} (key: {cache_key})")
            
            if not_cached_count > 0:
                self.stdout.write("\nNot Cached Pages:")
                for slug in published_pages:
                    cache_key = f'invite_page:{slug}'
                    if cache.get(cache_key) is None:
                        self.stdout.write(f"  ❌ {slug}")
        
        # Cache configuration
        self.stdout.write()
        self.stdout.write(self.style.WARNING("⚙️  Cache Configuration"))
        self.stdout.write("-" * 80)
        cache_config = settings.CACHES['default']
        self.stdout.write(f"Backend: {cache_config['BACKEND']}")
        if 'OPTIONS' in cache_config:
            cache_options = cache_config['OPTIONS']
            if 'MAX_ENTRIES' in cache_options:
                self.stdout.write(f"Max Entries: {cache_options['MAX_ENTRIES']}")
            if 'CULL_FREQUENCY' in cache_options:
                self.stdout.write(f"Cull Frequency: {cache_options['CULL_FREQUENCY']}")
        
        self.stdout.write()
        self.stdout.write(self.style.SUCCESS("✅ Cache statistics displayed"))

