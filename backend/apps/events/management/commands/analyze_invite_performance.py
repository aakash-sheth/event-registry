"""
Django management command to analyze invite page performance
Usage: python manage.py analyze_invite_performance [slug]
"""
from django.core.management.base import BaseCommand
from django.db import connection
from apps.events.models import InvitePage, Event, SubEvent, GuestSubEventInvite
from django.conf import settings


class Command(BaseCommand):
    help = 'Analyze invite page performance issues'

    def add_arguments(self, parser):
        parser.add_argument('slug', nargs='?', type=str, help='Optional: Test with specific slug (e.g., envolope-test1)')

    def handle(self, *args, **options):
        slug = options.get('slug', 'envolope-test1')
        
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("DATABASE PERFORMANCE ANALYSIS"))
        self.stdout.write("=" * 80)
        self.stdout.write()
        
        # 1. Check if migration 0024 index exists
        self.stdout.write(self.style.WARNING("1️⃣  CHECKING INDEXES"))
        self.stdout.write("-" * 80)
        with connection.cursor() as cursor:
            # Check invite_pages indexes
            cursor.execute("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'invite_pages'
                ORDER BY indexname;
            """)
            invite_indexes = cursor.fetchall()
            self.stdout.write(f"📊 InvitePage indexes ({len(invite_indexes)} total):")
            for idx_name, idx_def in invite_indexes:
                self.stdout.write(f"   - {idx_name}")
                if 'invite_slug_pub_idx' in idx_name:
                    self.stdout.write(self.style.SUCCESS(f"     ✅ CRITICAL INDEX FOUND: {idx_name}"))
                    self.stdout.write(f"     Definition: {idx_def[:100]}...")
            
            # Check if the critical index exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM pg_indexes 
                WHERE tablename = 'invite_pages' 
                AND indexname = 'invite_slug_pub_idx';
            """)
            has_index = cursor.fetchone()[0] > 0
            if not has_index:
                self.stdout.write(self.style.ERROR("   ❌ CRITICAL: invite_slug_pub_idx index is MISSING!"))
                self.stdout.write(self.style.ERROR("   ⚠️  This is likely causing slow queries!"))
            self.stdout.write()
            
            # Check sub_events indexes
            cursor.execute("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'sub_events'
                ORDER BY indexname;
            """)
            sub_event_indexes = cursor.fetchall()
            self.stdout.write(f"📊 SubEvent indexes ({len(sub_event_indexes)} total):")
            for idx_name, idx_def in sub_event_indexes:
                self.stdout.write(f"   - {idx_name}")
            self.stdout.write()
            
            # Check for recommended indexes
            cursor.execute("""
                SELECT COUNT(*) 
                FROM pg_indexes 
                WHERE tablename = 'sub_events' 
                AND indexdef LIKE '%is_public_visible%'
                AND indexdef LIKE '%is_removed%';
            """)
            has_sub_event_index = cursor.fetchone()[0] > 0
            if not has_sub_event_index:
                self.stdout.write(self.style.WARNING("   ⚠️  Missing index on (event_id, is_public_visible, is_removed)"))
                self.stdout.write(self.style.WARNING("   This could slow down sub-events queries"))
            self.stdout.write()

        # 2. Check table sizes
        self.stdout.write(self.style.WARNING("2️⃣  TABLE SIZES"))
        self.stdout.write("-" * 80)
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT 
                    tablename,
                    pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS size,
                    pg_total_relation_size('public.'||tablename) AS size_bytes
                FROM pg_tables
                WHERE schemaname = 'public'
                AND tablename IN ('invite_pages', 'events', 'sub_events', 'guest_sub_event_invites', 'guests')
                ORDER BY pg_total_relation_size('public.'||tablename) DESC;
            """)
            sizes = cursor.fetchall()
            for table, size, size_bytes in sizes:
                self.stdout.write(f"   {table:30} {size:15} ({size_bytes:,} bytes)")
            self.stdout.write()

        # 3. Check row counts
        self.stdout.write(self.style.WARNING("3️⃣  ROW COUNTS"))
        self.stdout.write("-" * 80)
        self.stdout.write(f"   Events:                    {Event.objects.count():,}")
        self.stdout.write(f"   InvitePages:               {InvitePage.objects.count():,}")
        self.stdout.write(f"   Published InvitePages:    {InvitePage.objects.filter(is_published=True).count():,}")
        self.stdout.write(f"   Unpublished InvitePages:  {InvitePage.objects.filter(is_published=False).count():,}")
        self.stdout.write(f"   SubEvents:                 {SubEvent.objects.count():,}")
        self.stdout.write(f"   Public SubEvents:          {SubEvent.objects.filter(is_public_visible=True, is_removed=False).count():,}")
        self.stdout.write(f"   GuestSubEventInvites:      {GuestSubEventInvite.objects.count():,}")
        self.stdout.write()

        # 4. Check for slow query patterns
        self.stdout.write(self.style.WARNING("4️⃣  QUERY PERFORMANCE ANALYSIS"))
        self.stdout.write("-" * 80)
        self.stdout.write(f"Testing query for slug: {slug}")
        self.stdout.write()

        # Test 1: InvitePage lookup with index
        self.stdout.write("Test 1: InvitePage lookup (slug + is_published)")
        with connection.cursor() as cursor:
            cursor.execute("EXPLAIN ANALYZE SELECT * FROM invite_pages WHERE slug = %s AND is_published = true;", [slug])
            result = cursor.fetchall()
            for row in result:
                self.stdout.write(f"   {row[0]}")
        self.stdout.write()

        # Test 2: Event lookup
        self.stdout.write("Test 2: Event lookup by slug")
        with connection.cursor() as cursor:
            cursor.execute("EXPLAIN ANALYZE SELECT id, slug, page_config, event_structure, title, description, date, has_rsvp, has_registry FROM events WHERE slug = %s;", [slug])
            result = cursor.fetchall()
            for row in result:
                self.stdout.write(f"   {row[0]}")
        self.stdout.write()

        # Test 3: SubEvents query (public)
        self.stdout.write("Test 3: SubEvents query (public, not removed)")
        try:
            event = Event.objects.get(slug=slug)
            with connection.cursor() as cursor:
                cursor.execute("""
                    EXPLAIN ANALYZE 
                    SELECT id, title, start_at, end_at, location, description, image_url, rsvp_enabled 
                    FROM sub_events 
                    WHERE event_id = %s AND is_public_visible = true AND is_removed = false 
                    ORDER BY start_at;
                """, [event.id])
                result = cursor.fetchall()
                for row in result:
                    self.stdout.write(f"   {row[0]}")
        except Event.DoesNotExist:
            self.stdout.write(self.style.WARNING(f"   ⚠️  Event with slug '{slug}' not found, skipping sub-events test"))
        self.stdout.write()

        # 5. Check for missing invite pages
        self.stdout.write(self.style.WARNING("5️⃣  INVITE PAGE STATUS"))
        self.stdout.write("-" * 80)
        events_without_invite = Event.objects.filter(invite_page__isnull=True).count()
        events_with_invite = Event.objects.filter(invite_page__isnull=False).count()
        self.stdout.write(f"   Events without InvitePage:  {events_without_invite:,}")
        self.stdout.write(f"   Events with InvitePage:    {events_with_invite:,}")
        if events_without_invite > 0:
            self.stdout.write(self.style.WARNING(f"   ⚠️  {events_without_invite} events will trigger get_or_create on first access"))
        self.stdout.write()

        # 6. Check database connection settings
        self.stdout.write(self.style.WARNING("6️⃣  DATABASE CONNECTION SETTINGS"))
        self.stdout.write("-" * 80)
        db_config = settings.DATABASES['default']
        self.stdout.write(f"   Engine:        {db_config.get('ENGINE', 'N/A')}")
        self.stdout.write(f"   Host:          {db_config.get('HOST', 'N/A')}")
        self.stdout.write(f"   Port:          {db_config.get('PORT', 'N/A')}")
        self.stdout.write(f"   Name:          {db_config.get('NAME', 'N/A')}")
        self.stdout.write(f"   CONN_MAX_AGE:  {db_config.get('CONN_MAX_AGE', 'Not set (default: 0)')}")
        if 'OPTIONS' in db_config:
            self.stdout.write(f"   OPTIONS:       {db_config.get('OPTIONS', {})}")
        else:
            self.stdout.write(self.style.WARNING("   OPTIONS:       Not set (no connection pooling)"))
        self.stdout.write()

        # 7. Recommendations
        self.stdout.write(self.style.WARNING("7️⃣  RECOMMENDATIONS"))
        self.stdout.write("-" * 80)
        with connection.cursor() as cursor:
            # Check if migration 0024 index exists
            cursor.execute("""
                SELECT COUNT(*) 
                FROM pg_indexes 
                WHERE tablename = 'invite_pages' 
                AND indexname = 'invite_slug_pub_idx';
            """)
            has_index = cursor.fetchone()[0] > 0
            
            if not has_index:
                self.stdout.write(self.style.ERROR("   ❌ URGENT: Apply migration 0024 to add invite_slug_pub_idx index"))
                self.stdout.write("      Run: python manage.py migrate events")
            
            # Check for sub-events index
            cursor.execute("""
                SELECT COUNT(*) 
                FROM pg_indexes 
                WHERE tablename = 'sub_events' 
                AND (indexdef LIKE '%is_public_visible%' AND indexdef LIKE '%is_removed%');
            """)
            has_sub_index = cursor.fetchone()[0] > 0
            
            if not has_sub_index:
                self.stdout.write(self.style.WARNING("   ⚠️  Consider adding index on sub_events (event_id, is_public_visible, is_removed)"))
            
            # Check connection pooling
            if db_config.get('CONN_MAX_AGE', 0) == 0:
                self.stdout.write(self.style.WARNING("   ⚠️  Consider enabling connection pooling (CONN_MAX_AGE)"))
            
            # Check table sizes
            cursor.execute("""
                SELECT pg_total_relation_size('invite_pages') + pg_total_relation_size('sub_events');
            """)
            total_size = cursor.fetchone()[0]
            if total_size > 100 * 1024 * 1024:  # > 100MB
                self.stdout.write(self.style.WARNING(f"   ⚠️  Large table sizes detected ({total_size / 1024 / 1024:.1f} MB)"))
                self.stdout.write("      Consider adding more indexes or optimizing queries")

        self.stdout.write()
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("ANALYSIS COMPLETE"))
        self.stdout.write("=" * 80)

