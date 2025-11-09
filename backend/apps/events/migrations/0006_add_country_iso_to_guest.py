# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0005_add_country_to_event'),
    ]

    operations = [
        migrations.AddField(
            model_name='guest',
            name='country_iso',
            field=models.CharField(blank=True, help_text='ISO 3166-1 alpha-2 country code for analytics (e.g., IN, US, CA)', max_length=2),
        ),
    ]

