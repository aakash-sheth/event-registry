"""
Django management command to create InvitePage records for all events that don't have one.

This migration utility creates InvitePage records for legacy events that were created
before the InvitePage feature was introduced. This ensures all events have an InvitePage
record, which is required for the invite page functionality.

Usage: python manage.py create_missing_invite_pages [--dry-run] [--publish-existing]
"""
from django.core.management.base import BaseCommand
from apps.events.models import Event, InvitePage
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Create InvitePage records for all events that don\'t have one'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without actually creating records',
        )
        parser.add_argument(
            '--publish-existing',
            action='store_true',
            help='Mark InvitePage as published if the event already has page_config (for events that were previously public)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        publish_existing = options['publish_existing']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('🔍 DRY RUN - No changes will be made'))
            self.stdout.write('')
        
        # Find all events that don't have an InvitePage
        events_without_invite_page = Event.objects.filter(
            invite_page__isnull=True
        ).select_related('host').order_by('id')
        
        total_events = events_without_invite_page.count()
        
        if total_events == 0:
            self.stdout.write(self.style.SUCCESS('✅ All events already have InvitePage records!'))
            return
        
        self.stdout.write(f'Found {total_events} events without InvitePage records')
        self.stdout.write('=' * 80)
        self.stdout.write('')
        
        created_count = 0
        skipped_count = 0
        error_count = 0
        errors = []
        
        for event in events_without_invite_page:
            try:
                # Skip events without slugs (they can't have invite pages)
                if not event.slug or event.slug.strip() == '':
                    skipped_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f'⏭️  Skipped: {event.title} (ID: {event.id}) - No slug'
                        )
                    )
                    continue
                
                # Determine if this should be published
                # Only publish if:
                # 1. --publish-existing flag is set
                # 2. Event has page_config (indicating it was previously configured)
                should_publish = publish_existing and bool(event.page_config)
                
                if dry_run:
                    self.stdout.write(
                        f'  Would create InvitePage for: {event.title} '
                        f'(ID: {event.id}, Slug: {event.slug.lower()}, '
                        f'Published: {should_publish})'
                    )
                else:
                    # Create InvitePage with event's data
                    invite_page = InvitePage.objects.create(
                        event=event,
                        slug=event.slug.lower(),  # Normalize to lowercase
                        config=event.page_config or {},
                        background_url=event.banner_image or '',
                        is_published=should_publish,
                    )
                    
                    created_count += 1
                    status_icon = '✅' if should_publish else '📝'
                    status_text = 'published' if should_publish else 'draft'
                    
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'{status_icon} Created {status_text} InvitePage for: {event.title} '
                            f'(ID: {event.id}, Slug: {invite_page.slug})'
                        )
                    )
                    
                    # Log to Django logger for CloudWatch/audit trail
                    logger.info(
                        f'Created InvitePage for event {event.id} (slug: {invite_page.slug}, '
                        f'published: {should_publish})'
                    )
                    
            except Exception as e:
                error_count += 1
                error_msg = f'Failed to create InvitePage for {event.title} (ID: {event.id}): {str(e)}'
                errors.append(error_msg)
                
                self.stdout.write(
                    self.style.ERROR(f'❌ {error_msg}')
                )
                
                logger.error(
                    f'Error creating InvitePage for event {event.id}: {str(e)}',
                    exc_info=True
                )
        
        # Print summary
        self.stdout.write('')
        self.stdout.write('=' * 80)
        self.stdout.write(self.style.SUCCESS('📊 SUMMARY'))
        self.stdout.write('=' * 80)
        self.stdout.write(f'  Total events without InvitePage: {total_events}')
        self.stdout.write(f'  Created: {created_count}')
        self.stdout.write(f'  Skipped (no slug): {skipped_count}')
        self.stdout.write(f'  Errors: {error_count}')
        
        if errors:
            self.stdout.write('')
            self.stdout.write(self.style.ERROR('❌ ERRORS:'))
            for error in errors:
                self.stdout.write(f'  - {error}')
        
        if dry_run:
            self.stdout.write('')
            self.stdout.write(
                self.style.WARNING(
                    '⚠️  This was a dry run. Run without --dry-run to create InvitePage records.'
                )
            )
        else:
            self.stdout.write('')
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Migration complete! Created {created_count} InvitePage records.'
                )
            )
            
            if publish_existing:
                self.stdout.write(
                    self.style.WARNING(
                        '⚠️  Note: Some InvitePages were created as published because --publish-existing was used.'
                    )
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        '⚠️  Note: All InvitePages were created as draft (unpublished). '
                        'Use --publish-existing to publish events that already had page_config.'
                    )
                )

