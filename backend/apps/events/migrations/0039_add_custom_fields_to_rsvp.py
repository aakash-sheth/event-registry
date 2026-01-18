from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('events', '0038_add_timezone_to_event'),
    ]

    operations = [
        migrations.AddField(
            model_name='rsvp',
            name='custom_fields',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='RSVP custom answers (normalized key -> value)',
            ),
        ),
    ]

