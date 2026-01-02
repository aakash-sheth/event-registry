# Generated manually - Rename WhatsAppTemplate model to MessageTemplate
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
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
                help_text='User who created this template',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_message_templates',
                to=settings.AUTH_USER_MODEL
            ),
        ),
        # Note: db_table stays as 'whatsapp_templates' to avoid breaking existing data
        # The model name change doesn't require table rename
    ]

