from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0070_campaignrecipient_email_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='HostSendQuota',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel', models.CharField(
                    choices=[('whatsapp', 'WhatsApp'), ('email', 'Email')],
                    max_length=20,
                )),
                ('monthly_limit', models.IntegerField(
                    help_text='Maximum messages per calendar month (0 = blocked)',
                )),
                ('notes', models.TextField(blank=True, help_text='Internal notes about this quota')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('host', models.ForeignKey(
                    help_text='The event host this quota applies to',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='send_quotas',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('set_by', models.ForeignKey(
                    blank=True,
                    help_text='Staff member who configured this quota',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='quotas_set',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'host_send_quotas',
                'ordering': ['host', 'channel'],
                'unique_together': {('host', 'channel')},
            },
        ),
    ]
