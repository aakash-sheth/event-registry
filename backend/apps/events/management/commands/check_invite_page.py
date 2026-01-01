"""
Django management command to check invite page status
Usage: python manage.py check_invite_page <slug>
"""
from django.core.management.base import BaseCommand
from apps.events.models import Event, InvitePage


class Command(BaseCommand):
    help = 'Check invite page status for a given slug'

    def add_arguments(self, parser):
        parser.add_argument('slug', type=str, help='Event or invite page slug to check')

    def handle(self, *args, **options):
        slug = options['slug']
        
        self.stdout.write(f'🔍 Checking event with slug: {slug}')
        self.stdout.write('=' * 60)
        
        # Check event
        try:
            event = Event.objects.get(slug=slug)
            self.stdout.write(self.style.SUCCESS(f'✅ Event found:'))
            self.stdout.write(f'   ID: {event.id}')
            self.stdout.write(f'   Title: {event.title}')
            self.stdout.write(f'   Slug: {event.slug}')
            self.stdout.write(f'   Has RSVP: {event.has_rsvp}')
            self.stdout.write(f'   Has Registry: {event.has_registry}')
            self.stdout.write(f'   Event Structure: {event.event_structure}')
            self.stdout.write(f'   Has page_config: {bool(event.page_config)}')
            if event.page_config:
                if isinstance(event.page_config, dict):
                    self.stdout.write(f'   page_config keys: {list(event.page_config.keys())}')
                else:
                    self.stdout.write(f'   page_config type: {type(event.page_config)}')
            self.stdout.write('')
            
            # Check invite page
            try:
                invite_page = InvitePage.objects.get(event=event)
                self.stdout.write(self.style.SUCCESS(f'✅ InvitePage found:'))
                self.stdout.write(f'   ID: {invite_page.id}')
                self.stdout.write(f'   Slug: {invite_page.slug}')
                self.stdout.write(f'   Is Published: {invite_page.is_published}')
                self.stdout.write(f'   Has Config: {bool(invite_page.config)}')
                if invite_page.config:
                    if isinstance(invite_page.config, dict):
                        self.stdout.write(f'   Config Keys: {list(invite_page.config.keys())}')
                    else:
                        self.stdout.write(f'   Config type: {type(invite_page.config)}')
                self.stdout.write('')
                
                # Check for issues
                issues = []
                if invite_page.slug != slug:
                    issues.append(f'❌ Slug mismatch! InvitePage slug ({invite_page.slug}) != requested slug ({slug})')
                if not invite_page.is_published:
                    issues.append(f'❌ InvitePage is NOT published (is_published=False)')
                
                if issues:
                    self.stdout.write(self.style.WARNING('⚠️  ISSUES FOUND:'))
                    for issue in issues:
                        self.stdout.write(f'   {issue}')
                else:
                    self.stdout.write(self.style.SUCCESS('✅ No issues found - invite page should be accessible'))
                    
            except InvitePage.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'❌ InvitePage does NOT exist for this event'))
                self.stdout.write(f'   Will be auto-created on first access via API')
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'❌ Error checking InvitePage: {e}'))
                import traceback
                self.stdout.write(traceback.format_exc())
                
            # Check all invite pages with similar slugs
            self.stdout.write('')
            self.stdout.write('🔍 Checking all InvitePages with similar slugs:')
            similar_invites = InvitePage.objects.filter(slug__icontains=slug[:8])
            if similar_invites.exists():
                for ip in similar_invites:
                    self.stdout.write(f'   - Slug: {ip.slug}, Published: {ip.is_published}, Event: {ip.event.slug}')
            else:
                self.stdout.write('   No similar invite pages found')
                
        except Event.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'❌ Event NOT found with slug: {slug}'))
            self.stdout.write('')
            self.stdout.write('🔍 Checking for similar slugs (case-insensitive):')
            similar_events = Event.objects.filter(slug__icontains=slug[:8])
            if similar_events.exists():
                for e in similar_events:
                    self.stdout.write(f'   - Slug: {e.slug}, Title: {e.title}')
            else:
                self.stdout.write('   No similar events found')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Error: {e}'))
            import traceback
            self.stdout.write(traceback.format_exc())

