"""
Django management command to sync Event.page_config to InvitePage.config
Fix 6: Migration strategy for single source of truth

This command creates InvitePage records for all Events that have page_config
but don't have an InvitePage yet. This ensures data consistency before
making InvitePage.config the single source of truth.

Usage: python manage.py sync_event_page_config_to_invite_pages [--dry-run]
"""
from django.core.management.base import BaseCommand
from apps.events.models import Event, InvitePage


class Command(BaseCommand):
    help = 'Sync Event.page_config to InvitePage.config for all events'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be synced without actually creating/updating',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - No changes will be made'))
            self.stdout.write('')
        
        # Find events with page_config but no InvitePage
        events_with_config = Event.objects.filter(
            page_config__isnull=False
        ).exclude(
            page_config={}
        )
        
        total_events = events_with_config.count()
        self.stdout.write(f'Found {total_events} events with page_config')
        
        created_count = 0
        updated_count = 0
        skipped_count = 0
        
        for event in events_with_config:
            try:
                invite_page, created = InvitePage.objects.get_or_create(
                    event=event,
                    defaults={
                        'slug': event.slug,
                        'config': event.page_config,
                        'background_url': event.banner_image or '',
                        'is_published': False,
                    }
                )
                
                if created:
                    created_count += 1
                    if not dry_run:
                        self.stdout.write(
                            self.style.SUCCESS(
                                f'✅ Created InvitePage for: {event.title} (slug: {invite_page.slug})'
                            )
                        )
                    else:
                        self.stdout.write(
                            f'  Would create InvitePage for: {event.title} (slug: {event.slug})'
                        )
                else:
                    # Update existing InvitePage if config is empty or different
                    if not invite_page.config or invite_page.config != event.page_config:
                        if not dry_run:
                            invite_page.config = event.page_config
                            if event.banner_image:
                                invite_page.background_url = event.banner_image
                            invite_page.save(update_fields=['config', 'background_url', 'updated_at'])
                            updated_count += 1
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f'✅ Updated InvitePage for: {event.title} (slug: {invite_page.slug})'
                                )
                            )
                        else:
                            self.stdout.write(
                                f'  Would update InvitePage for: {event.title} (slug: {invite_page.slug})'
                            )
                    else:
                        skipped_count += 1
                        self.stdout.write(
                            f'  ⏭️  Skipped (already synced): {event.title}'
                        )
                        
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'❌ Failed to sync InvitePage for {event.title}: {e}'
                    )
                )
        
        self.stdout.write('')
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS(f'Summary:'))
        self.stdout.write(f'  Total events with page_config: {total_events}')
        self.stdout.write(f'  Created: {created_count}')
        self.stdout.write(f'  Updated: {updated_count}')
        self.stdout.write(f'  Skipped: {skipped_count}')
        
        if dry_run:
            self.stdout.write('')
            self.stdout.write(self.style.WARNING('This was a dry run. Run without --dry-run to apply changes.'))

