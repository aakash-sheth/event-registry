from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0056_bookingschedule_status_dates'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='bookingschedule',
            name='active_since',
        ),
        migrations.RemoveField(
            model_name='bookingschedule',
            name='paused_since',
        ),
    ]
