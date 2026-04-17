from django.db import migrations, models


def backfill_rsvp_experience_mode(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    BookingSchedule = apps.get_model('events', 'BookingSchedule')
    BookingSlot = apps.get_model('events', 'BookingSlot')

    schedule_event_ids = set(
        BookingSchedule.objects.filter(is_enabled=True).values_list('event_id', flat=True)
    )
    active_slot_event_ids = set(
        BookingSlot.objects.filter(status='available').values_list('event_id', flat=True)
    )

    for event in Event.objects.all().iterator():
        if event.event_structure == 'ENVELOPE':
            mode = 'sub_event'
        elif event.id in schedule_event_ids and event.id in active_slot_event_ids:
            mode = 'slot_based'
        else:
            mode = 'standard'
        if event.rsvp_experience_mode != mode:
            event.rsvp_experience_mode = mode
            event.save(update_fields=['rsvp_experience_mode'])


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0054_slot_booking_module'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='rsvp_experience_mode',
            field=models.CharField(
                choices=[('standard', 'Standard RSVP'), ('sub_event', 'Sub-event RSVP'), ('slot_based', 'Slot-based RSVP')],
                default='standard',
                help_text='Canonical RSVP mode used for host settings and guest rendering.',
                max_length=20,
            ),
        ),
        migrations.RunPython(backfill_rsvp_experience_mode, migrations.RunPython.noop),
    ]
