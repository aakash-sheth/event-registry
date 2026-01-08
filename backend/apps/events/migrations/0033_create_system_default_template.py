# Generated migration - Auto-create system default template
from django.db import migrations


def create_system_default_template(apps, schema_editor):
    """Create the global system default WhatsApp template"""
    Event = apps.get_model('events', 'Event')
    MessageTemplate = apps.get_model('events', 'MessageTemplate')
    User = apps.get_model('users', 'User')  # Use historical model
    
    # Check if system default already exists
    existing = MessageTemplate.objects.filter(is_system_default=True).first()
    if existing:
        return
    
    # Get or create a system event for the template
    # We need an event because MessageTemplate requires it
    # Get first user as placeholder, or create event without host if no users exist
    first_user = User.objects.first()
    if not first_user:
        # If no users exist, skip creating the system event
        # The template can be created later when a user exists
        return
    
    system_event, created = Event.objects.get_or_create(
        slug='system-default',
        defaults={
            'title': 'System Default Template Event',
            'host': first_user,  # Use first user as placeholder
            'event_type': 'other',
            'is_public': False,
        }
    )
    
    # Create system default template
    MessageTemplate.objects.create(
        event=system_event,
        name='System Default Invitation',
        message_type='invitation',
        template_text='Hey [name]! 💛\n\nJust wanted to share [event_title] on [event_date]!\n\nPlease confirm here: [event_url]\n\n- [host_name]',
        description='Default template used when no event-specific default is set. This is a global template visible in all events.',
        is_system_default=True,
        is_default=False,  # Not an event default, but system default
        is_active=True,
    )


def reverse_create_system_default_template(apps, schema_editor):
    """Remove the system default template (optional - for rollback)"""
    MessageTemplate = apps.get_model('events', 'MessageTemplate')
    MessageTemplate.objects.filter(is_system_default=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0032_alter_event_event_type'),
    ]

    operations = [
        migrations.RunPython(
            create_system_default_template,
            reverse_create_system_default_template
        ),
    ]

