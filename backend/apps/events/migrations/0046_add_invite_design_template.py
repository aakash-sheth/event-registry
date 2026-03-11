# Generated migration for InviteDesignTemplate (Template Studio)

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0045_add_analytics_visibility_gate'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='InviteDesignTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('thumbnail', models.URLField(blank=True, max_length=2000)),
                ('preview_alt', models.CharField(blank=True, max_length=255)),
                ('config', models.JSONField(default=dict, help_text='Full InviteConfig: themeId, tiles, customColors, texture, etc.')),
                ('visibility', models.CharField(choices=[('internal', 'Internal'), ('public', 'Public'), ('premium', 'Premium')], default='public', max_length=20)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('published', 'Published')], default='draft', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_premium', models.BooleanField(default=False)),
                ('price_cents', models.IntegerField(blank=True, null=True)),
                ('creator_share_percent', models.IntegerField(blank=True, null=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='created_invite_design_templates', to=settings.AUTH_USER_MODEL)),
                ('creator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='creator_invite_design_templates', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='updated_invite_design_templates', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'invite_design_templates',
                'ordering': ['-updated_at'],
            },
        ),
        migrations.AddIndex(
            model_name='invitedesigntemplate',
            index=models.Index(fields=['visibility'], name='invite_dt_visibility_idx'),
        ),
        migrations.AddIndex(
            model_name='invitedesigntemplate',
            index=models.Index(fields=['status'], name='invite_dt_status_idx'),
        ),
        migrations.AddIndex(
            model_name='invitedesigntemplate',
            index=models.Index(fields=['visibility', 'status'], name='invite_dt_vis_status_idx'),
        ),
    ]
