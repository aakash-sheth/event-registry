from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_add_notification_preference'),
    ]

    operations = [
        migrations.CreateModel(
            name='StaffNotificationRecipient',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('name', models.CharField(blank=True, max_length=100)),
                ('notify_on_signup', models.BooleanField(default=True, help_text='Send an immediate email when a new user signs up')),
                ('receive_daily_digest', models.BooleanField(default=True, help_text='Include in the daily business summary email')),
                ('is_active', models.BooleanField(default=True, help_text='Uncheck to stop all emails without deleting this row')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'staff_notification_recipients',
                'ordering': ['email'],
            },
        ),
    ]
