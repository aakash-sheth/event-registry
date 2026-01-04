# Generated migration - Add background_color field to SubEvent model
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0029_add_cached_sub_event_counts'),
    ]

    operations = [
        migrations.AddField(
            model_name='subevent',
            name='background_color',
            field=models.CharField(
                blank=True,
                help_text='Background color for sub-event image (hex format, e.g., #FFFFFF)',
                max_length=7,
                null=True
            ),
        ),
    ]

