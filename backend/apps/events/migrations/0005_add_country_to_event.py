# Generated manually - Add country field to Event
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0004_alter_guest_phone_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='country',
            field=models.CharField(default='IN', help_text='ISO 3166-1 alpha-2 country code (e.g., IN, US, UK)', max_length=2),
        ),
    ]

