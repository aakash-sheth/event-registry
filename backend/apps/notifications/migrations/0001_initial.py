# Generated migration
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='NotificationLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('channel', models.CharField(choices=[('email', 'Email'), ('whatsapp', 'WhatsApp')], max_length=20)),
                ('to', models.CharField(max_length=255)),
                ('template', models.CharField(blank=True, max_length=100)),
                ('payload_json', models.JSONField(default=dict)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('sent', 'Sent'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('last_error', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'notification_logs',
                'ordering': ['-created_at'],
            },
        ),
    ]

