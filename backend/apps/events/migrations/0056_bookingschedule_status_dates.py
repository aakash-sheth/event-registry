from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0055_event_rsvp_experience_mode'),
    ]

    operations = [
        migrations.AddField(
            model_name='bookingschedule',
            name='active_since',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='bookingschedule',
            name='paused_since',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='bookingschedule',
            name='status_changed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
