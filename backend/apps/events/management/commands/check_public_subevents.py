"""
Check if events have sub-events but none are public-visible
This could cause issues when loading invite pages without guest tokens
"""
from django.core.management.base import BaseCommand
from apps.events.models import SubEvent, Event


class Command(BaseCommand):
    help = 'Check SubEvent public visibility status'

    def handle(self, *args, **options):
        self.stdout.write("🔍 Checking SubEvent data:")
        self.stdout.write("=" * 60)

        # Count total sub-events
        total = SubEvent.objects.count()
        self.stdout.write(f"Total SubEvents: {total}")

        # Count by is_public_visible
        public_visible = SubEvent.objects.filter(is_public_visible=True).count()
        not_public_visible = SubEvent.objects.filter(is_public_visible=False).count()
        null_public_visible = SubEvent.objects.filter(is_public_visible__isnull=True).count()

        self.stdout.write(f"\nBy is_public_visible:")
        self.stdout.write(f"  - is_public_visible=True: {public_visible}")
        self.stdout.write(f"  - is_public_visible=False: {not_public_visible}")
        self.stdout.write(f"  - is_public_visible=null: {null_public_visible}")

        # Count by is_removed
        removed = SubEvent.objects.filter(is_removed=True).count()
        not_removed = SubEvent.objects.filter(is_removed=False).count()

        self.stdout.write(f"\nBy is_removed:")
        self.stdout.write(f"  - is_removed=True: {removed}")
        self.stdout.write(f"  - is_removed=False: {not_removed}")

        # Count public-visible and not removed (what public links see)
        public_available = SubEvent.objects.filter(
            is_public_visible=True, 
            is_removed=False
        ).count()
        self.stdout.write(f"\n✅ Available for public links (is_public_visible=True AND is_removed=False): {public_available}")

        # Check events with sub-events but none public
        events_with_subevents = Event.objects.filter(
            sub_events__isnull=False
        ).distinct().prefetch_related('sub_events')
        
        events_no_public = []
        for event in events_with_subevents:
            total_count = event.sub_events.filter(is_removed=False).count()
            if total_count > 0:
                public_count = event.sub_events.filter(
                    is_public_visible=True, 
                    is_removed=False
                ).count()
                if public_count == 0:
                    events_no_public.append({
                        'slug': event.slug,
                        'title': event.title,
                        'event_structure': event.event_structure,
                        'total_subevents': total_count,
                        'public_subevents': public_count
                    })

        if events_no_public:
            self.stdout.write(self.style.WARNING(
                f"\n⚠️  Events with sub-events but NONE are public-visible ({len(events_no_public)} events):"
            ))
            for e in events_no_public:
                self.stdout.write(
                    f"  - {e['slug']} ({e['event_structure']}): "
                    f"{e['total_subevents']} sub-events, {e['public_subevents']} public"
                )
            self.stdout.write(
                self.style.ERROR(
                    "\n❌ These events will show NO sub-events on public invite links (no ?g= token)!"
                )
            )
        else:
            self.stdout.write(self.style.SUCCESS(
                "\n✅ All events with sub-events have at least one public-visible sub-event"
            ))

        # Check if any ENVELOPE events have no public sub-events (performance concern)
        envelope_events_no_public = [
            e for e in events_no_public 
            if e['event_structure'] == 'ENVELOPE'
        ]
        if envelope_events_no_public:
            self.stdout.write(self.style.WARNING(
                f"\n⚠️  ENVELOPE events with no public sub-events ({len(envelope_events_no_public)}):"
            ))
            self.stdout.write(
                "   These will still run the sub-events query even though it returns 0 results."
            )
            self.stdout.write(
                "   Consider optimizing: skip query if event has sub-events but none are public."
            )

