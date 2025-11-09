# Generated manually - Add event page customization fields
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0006_add_country_iso_to_guest'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='banner_image',
            field=models.URLField(blank=True, help_text='Banner image URL for public invitation page', max_length=500),
        ),
        migrations.AddField(
            model_name='event',
            name='description',
            field=models.TextField(blank=True, help_text='Rich text description for public invitation page'),
        ),
        migrations.AddField(
            model_name='event',
            name='additional_photos',
            field=models.JSONField(blank=True, default=list, help_text='Array of up to 5 photo URLs (max 5MB each)'),
        ),
    ]

