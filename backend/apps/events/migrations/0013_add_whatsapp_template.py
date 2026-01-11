# Generated migration
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0012_add_page_config_to_event'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='whatsapp_message_template',
            field=models.TextField(
                blank=True,
                default='',
                help_text='WhatsApp message template with variables like [name], [event_title], [event_date], [event_location], [event_url], [host_name]. Leave empty to use default template.'
            ),
        ),
    ]







