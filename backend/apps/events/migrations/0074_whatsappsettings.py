import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0073_messagecampaign_qualified_count'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='WhatsAppSettings',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('enabled', models.BooleanField(default=False, help_text='Master switch. Must be True to send any WhatsApp messages.')),
                ('phone_number_id', models.CharField(blank=True, help_text='Meta Business phone number ID', max_length=100)),
                ('access_token', models.CharField(blank=True, help_text='Meta Cloud API permanent access token', max_length=1000)),
                ('app_secret', models.CharField(blank=True, help_text='Meta app secret (for webhook verification)', max_length=300)),
                ('webhook_verify_token', models.CharField(blank=True, default='change_me', help_text='Token for Meta webhook verification handshake', max_length=200)),
                ('send_delay_seconds', models.FloatField(default=0.2, help_text='Delay in seconds between consecutive sends (rate limiting)')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'WhatsApp Settings',
                'verbose_name_plural': 'WhatsApp Settings',
                'db_table': 'whatsapp_settings',
            },
        ),
    ]
