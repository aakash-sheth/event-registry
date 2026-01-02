# Generated manually - Rename WhatsAppTemplate model to MessageTemplate
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0027_sync_invite_page_slugs'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='WhatsAppTemplate',
            new_name='MessageTemplate',
        ),
        # Update related_name for ForeignKey from 'whatsapp_templates' to 'message_templates'
        migrations.AlterField(
            model_name='messagetemplate',
            name='event',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='message_templates',
                to='events.event'
            ),
        ),
        # Update related_name for created_by ForeignKey
        migrations.AlterField(
            model_name='messagetemplate',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_message_templates',
                to='users.user'
            ),
        ),
        # Note: db_table stays as 'whatsapp_templates' to avoid breaking existing data
        # The model name change doesn't require table rename
    ]

