# Generated manually - Add cached sub-event count fields to Event model
from django.db import migrations, models


def populate_initial_counts(apps, schema_editor):
    """
    Populate initial cached sub-event counts for all existing events.
    This ensures the cached counts are accurate from the start.
    """
    Event = apps.get_model('events', 'Event')
    SubEvent = apps.get_model('events', 'SubEvent')
    
    # Process events in batches for efficiency
    batch_size = 100
    events = Event.objects.all()
    total_events = events.count()
    
    updated_count = 0
    for i in range(0, total_events, batch_size):
        batch = events[i:i + batch_size]
        for event in batch:
            # Calculate counts efficiently
            total_count = SubEvent.objects.filter(
                event=event,
                is_removed=False
            ).count()
            
            public_count = SubEvent.objects.filter(
                event=event,
                is_public_visible=True,
                is_removed=False
            ).count()
            
            # Update only if values differ from default (0)
            if total_count != 0 or public_count != 0:
                event.total_sub_events_count = total_count
                event.public_sub_events_count = public_count
                event.save(update_fields=['total_sub_events_count', 'public_sub_events_count'])
                updated_count += 1


def reverse_populate_initial_counts(apps, schema_editor):
    """
    Reverse migration - reset counts to 0.
    This is safe because signals will repopulate them when sub-events are accessed.
    """
    Event = apps.get_model('events', 'Event')
    Event.objects.all().update(
        total_sub_events_count=0,
        public_sub_events_count=0
    )


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0028_rename_whatsapp_template_to_message_template'),
    ]

    operations = [
        # Add the two new cached count fields
        migrations.AddField(
            model_name='event',
            name='public_sub_events_count',
            field=models.IntegerField(
                default=0,
                help_text='Cached count of public-visible, non-removed sub-events (auto-updated via signals)'
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='total_sub_events_count',
            field=models.IntegerField(
                default=0,
                help_text='Cached count of all non-removed sub-events (auto-updated via signals)'
            ),
        ),
        # Populate initial values for existing events
        migrations.RunPython(
            populate_initial_counts,
            reverse_populate_initial_counts
        ),
    ]



