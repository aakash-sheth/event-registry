import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='NotificationPreference',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rsvp_new', models.CharField(
                    choices=[('immediately', 'Immediately'), ('daily_digest', 'Daily Digest'), ('never', 'Never')],
                    default='immediately', max_length=20,
                    help_text='How often to notify when a new RSVP is submitted',
                )),
                ('gift_received', models.CharField(
                    choices=[('immediately', 'Immediately'), ('daily_digest', 'Daily Digest'), ('never', 'Never')],
                    default='immediately', max_length=20,
                    help_text='How often to notify when a gift is received',
                )),
                ('marketing_emails', models.BooleanField(
                    default=True,
                    help_text='Receive product updates and tips from Ekfern',
                )),
                ('unsubscribe_token', models.UUIDField(
                    default=uuid.uuid4, unique=True, editable=False,
                    help_text='Token for one-click unsubscribe links in email footers',
                )),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notification_preferences',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'notification_preferences',
            },
        ),
        migrations.CreateModel(
            name='NotificationQueue',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('notification_type', models.CharField(max_length=50)),
                ('payload_json', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notification_queue',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'notification_queue',
                'ordering': ['created_at'],
            },
        ),
    ]
