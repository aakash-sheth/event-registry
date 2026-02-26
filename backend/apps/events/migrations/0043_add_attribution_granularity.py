from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0042_rename_whatsapp_te_event_i_c0c43c_idx_whatsapp_te_event_i_idx_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AttributionLink',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(db_index=True, max_length=16, unique=True)),
                ('target_type', models.CharField(choices=[('invite', 'Invite'), ('rsvp', 'RSVP'), ('registry', 'Registry')], max_length=20)),
                ('channel', models.CharField(choices=[('qr', 'QR Code'), ('link', 'Web Link')], default='qr', max_length=20)),
                ('campaign', models.CharField(blank=True, default='', max_length=100)),
                ('placement', models.CharField(blank=True, default='', max_length=100)),
                ('metadata', models.JSONField(blank=True, default=dict)),
                ('is_active', models.BooleanField(default=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('click_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_attribution_links', to=settings.AUTH_USER_MODEL)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attribution_links', to='events.event')),
                ('guest', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='attribution_links', to='events.guest')),
            ],
            options={
                'db_table': 'attribution_links',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AttributionClick',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('target_type', models.CharField(choices=[('invite', 'Invite'), ('rsvp', 'RSVP'), ('registry', 'Registry')], max_length=20)),
                ('channel', models.CharField(choices=[('qr', 'QR Code'), ('link', 'Web Link')], default='qr', max_length=20)),
                ('campaign', models.CharField(blank=True, default='', max_length=100)),
                ('placement', models.CharField(blank=True, default='', max_length=100)),
                ('ip_hash', models.CharField(blank=True, default='', max_length=64)),
                ('user_agent', models.TextField(blank=True, default='')),
                ('referer', models.TextField(blank=True, default='')),
                ('clicked_at', models.DateTimeField(auto_now_add=True)),
                ('attribution_link', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='clicks', to='events.attributionlink')),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='attribution_clicks', to='events.event')),
                ('guest', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='attribution_clicks', to='events.guest')),
            ],
            options={
                'db_table': 'attribution_clicks',
                'ordering': ['-clicked_at'],
            },
        ),
        migrations.AddField(
            model_name='invitepageview',
            name='attribution_link',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='invite_page_views', to='events.attributionlink'),
        ),
        migrations.AddField(
            model_name='invitepageview',
            name='campaign',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='invitepageview',
            name='placement',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='invitepageview',
            name='source_channel',
            field=models.CharField(choices=[('qr', 'QR Code'), ('link', 'Web Link'), ('manual', 'Manual')], default='link', max_length=20),
        ),
        migrations.AddField(
            model_name='rsvppageview',
            name='attribution_link',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='rsvp_page_views', to='events.attributionlink'),
        ),
        migrations.AddField(
            model_name='rsvppageview',
            name='campaign',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='rsvppageview',
            name='placement',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='rsvppageview',
            name='source_channel',
            field=models.CharField(choices=[('qr', 'QR Code'), ('link', 'Web Link'), ('manual', 'Manual')], default='link', max_length=20),
        ),
        migrations.AddIndex(
            model_name='attributionlink',
            index=models.Index(fields=['event', 'target_type', 'channel'], name='attr_links_event_target_idx'),
        ),
        migrations.AddIndex(
            model_name='attributionlink',
            index=models.Index(fields=['event', 'guest'], name='attr_links_event_guest_idx'),
        ),
        migrations.AddIndex(
            model_name='attributionlink',
            index=models.Index(fields=['is_active', 'expires_at'], name='attr_links_active_exp_idx'),
        ),
        migrations.AddConstraint(
            model_name='attributionlink',
            constraint=models.UniqueConstraint(fields=('event', 'guest', 'target_type', 'channel', 'campaign', 'placement'), name='attr_links_event_guest_unique'),
        ),
        migrations.AddIndex(
            model_name='attributionclick',
            index=models.Index(fields=['event', 'target_type', '-clicked_at'], name='attr_clicks_event_target_idx'),
        ),
        migrations.AddIndex(
            model_name='attributionclick',
            index=models.Index(fields=['attribution_link', '-clicked_at'], name='attr_clicks_link_time_idx'),
        ),
        migrations.AddIndex(
            model_name='attributionclick',
            index=models.Index(fields=['channel', '-clicked_at'], name='attr_clicks_channel_idx'),
        ),
        migrations.AddIndex(
            model_name='invitepageview',
            index=models.Index(fields=['event', 'source_channel', '-viewed_at'], name='invite_views_event_src_idx'),
        ),
        migrations.AddIndex(
            model_name='rsvppageview',
            index=models.Index(fields=['event', 'source_channel', '-viewed_at'], name='rsvp_views_event_src_idx'),
        ),
    ]
