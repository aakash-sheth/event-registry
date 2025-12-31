# Generated migration - Create WhatsAppTemplate model
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0020_add_sub_events_and_envelope'),
    ]

    operations = [
        migrations.CreateModel(
            name='WhatsAppTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(help_text="Template name (e.g., 'Initial Invitation', 'Venue Change Update')", max_length=100)),
                ('message_type', models.CharField(choices=[('invitation', 'Initial Invitation'), ('reminder', 'Reminder'), ('update', 'Event Update'), ('venue_change', 'Venue Change'), ('time_change', 'Time Change'), ('thank_you', 'Thank You'), ('custom', 'Custom Message')], default='custom', help_text='Type of message/update being sent', max_length=50)),
                ('template_text', models.TextField(help_text='Template with variables like [name], [event_title], [event_date], [event_url], [host_name], [event_location]')),
                ('description', models.TextField(blank=True, help_text='Optional description of when/why to use this template')),
                ('usage_count', models.IntegerField(default=0, help_text='Number of times this template has been used to send messages')),
                ('is_active', models.BooleanField(default=True, help_text='Whether this template is active and can be used')),
                ('last_used_at', models.DateTimeField(blank=True, help_text='When this template was last used to send a message', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='whatsapp_templates', to='events.event')),
            ],
            options={
                'db_table': 'whatsapp_templates',
                'ordering': ['-last_used_at', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='whatsapptemplate',
            index=models.Index(fields=['event', 'message_type'], name='whatsapp_te_event_i_idx'),
        ),
        migrations.AddIndex(
            model_name='whatsapptemplate',
            index=models.Index(fields=['event', 'is_active'], name='whatsapp_te_event_i_idx2'),
        ),
        migrations.AlterUniqueTogether(
            name='whatsapptemplate',
            unique_together={('event', 'name')},
        ),
    ]

