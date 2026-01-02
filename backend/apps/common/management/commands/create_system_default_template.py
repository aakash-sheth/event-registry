"""
Django management command to create the system default WhatsApp template.

This command creates a global system default template that can be used
when events don't have their own default template.

Usage:
    python manage.py create_system_default_template
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.events.models import Event, MessageTemplate

User = get_user_model()


class Command(BaseCommand):
    help = 'Create the system default WhatsApp template'

    def handle(self, *args, **options):
        # Check if system default already exists
        existing = MessageTemplate.objects.filter(is_system_default=True).first()
        if existing:
            self.stdout.write(
                self.style.WARNING(
                    f'System default template already exists: "{existing.name}" (ID: {existing.id})'
                )
            )
            return

        # Get or create a dummy event for the system template
        # We need an event because MessageTemplate requires it
        # We'll use a special system event or create one
        system_event, created = Event.objects.get_or_create(
            slug='system-default',
            defaults={
                'title': 'System Default Template Event',
                'host': User.objects.first(),  # Use first user as placeholder
                'event_type': 'other',
                'is_public': False,
            }
        )

        if created:
            self.stdout.write(
                self.style.SUCCESS(f'Created system event: {system_event.slug}')
            )

        # Create system default template
        template = MessageTemplate.objects.create(
            event=system_event,
            name='System Default Invitation',
            message_type='invitation',
            template_text='Hey [name]! 💛\n\nJust wanted to share [event_title] on [event_date]!\n\nPlease confirm here: [event_url]\n\n- [host_name]',
            description='Default template used when no event-specific default is set',
            is_system_default=True,
            is_default=False,  # Not an event default, but system default
            is_active=True,
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created system default template: "{template.name}" (ID: {template.id})'
            )
        )

