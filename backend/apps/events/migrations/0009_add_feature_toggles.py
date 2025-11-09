# Generated manually - Add feature toggles for RSVP and Registry
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0008_change_banner_image_to_textfield'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='has_rsvp',
            field=models.BooleanField(default=True, help_text='Enable RSVP functionality for this event'),
        ),
        migrations.AddField(
            model_name='event',
            name='has_registry',
            field=models.BooleanField(default=True, help_text='Enable Gift Registry functionality for this event'),
        ),
    ]

