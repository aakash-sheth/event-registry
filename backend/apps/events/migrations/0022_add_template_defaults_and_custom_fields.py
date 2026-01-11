# Generated migration - Add template defaults and custom fields
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0021_create_whatsapp_template'),
        ('users', '0001_initial'),  # Adjust if needed based on your users app migration
    ]

    operations = [
        # Add custom_fields_metadata to Event
        migrations.AddField(
            model_name='event',
            name='custom_fields_metadata',
            field=models.JSONField(blank=True, default=dict, help_text='Metadata for custom CSV columns: normalized key -> display label mapping'),
        ),
        
        # Add custom_fields to Guest
        migrations.AddField(
            model_name='guest',
            name='custom_fields',
            field=models.JSONField(blank=True, default=dict, help_text='Custom field values from CSV imports (normalized key -> value)'),
        ),
        
        # Add fields to WhatsAppTemplate
        migrations.AddField(
            model_name='whatsapptemplate',
            name='is_default',
            field=models.BooleanField(default=False, help_text='Whether this is the default template for the event (only one per event)'),
        ),
        migrations.AddField(
            model_name='whatsapptemplate',
            name='is_system_default',
            field=models.BooleanField(default=False, help_text='Whether this is the system-wide default template (only one globally, non-deletable)'),
        ),
        migrations.AddField(
            model_name='whatsapptemplate',
            name='created_by',
            field=models.ForeignKey(
                blank=True,
                help_text='User who created this template',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_whatsapp_templates',
                to='users.user'
            ),
        ),
        
        # Add indexes
        migrations.AddIndex(
            model_name='whatsapptemplate',
            index=models.Index(fields=['event', 'is_default'], name='whatsapp_te_event_i_idx3'),
        ),
        migrations.AddIndex(
            model_name='whatsapptemplate',
            index=models.Index(fields=['is_system_default'], name='whatsapp_te_is_syst_idx'),
        ),
        
        # Add unique constraints
        migrations.AddConstraint(
            model_name='whatsapptemplate',
            constraint=models.UniqueConstraint(
                condition=models.Q(is_default=True),
                fields=['event', 'is_default'],
                name='unique_default_per_event'
            ),
        ),
        migrations.AddConstraint(
            model_name='whatsapptemplate',
            constraint=models.UniqueConstraint(
                condition=models.Q(is_system_default=True),
                fields=['is_system_default'],
                name='unique_system_default'
            ),
        ),
    ]



