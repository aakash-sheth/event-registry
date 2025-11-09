# Generated manually - Change banner_image from URLField to TextField to support data URLs
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0007_add_event_page_customization'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='banner_image',
            field=models.TextField(blank=True, help_text='Banner image URL or data URL for public invitation page'),
        ),
    ]

