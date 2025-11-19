# Generated manually - Create InvitePage model
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0009_add_feature_toggles'),
    ]

    operations = [
        migrations.CreateModel(
            name='InvitePage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(blank=True, help_text='Auto-generated if not provided', max_length=100, unique=True)),
                ('background_url', models.TextField(blank=True, help_text='Background image URL or data URL')),
                ('config', models.JSONField(default=dict, help_text='Invite configuration (elements, theme, parallax)')),
                ('is_published', models.BooleanField(default=False, help_text='Whether the invite page is publicly accessible')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='invite_page', to='events.event')),
            ],
            options={
                'db_table': 'invite_pages',
                'ordering': ['-created_at'],
            },
        ),
    ]

