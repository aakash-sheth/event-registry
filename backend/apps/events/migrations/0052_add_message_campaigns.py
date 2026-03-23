# Generated 2026-03-21 — adds MessageCampaign and CampaignRecipient models

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0051_alter_analyticsbatchrun_options'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='MessageCampaign',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('message_mode', models.CharField(
                    choices=[
                        ('freeform', 'Free-form text (24h window only)'),
                        ('approved_template', 'Meta pre-approved template'),
                    ],
                    default='approved_template',
                    max_length=30,
                )),
                ('message_body', models.TextField(
                    help_text='Raw template text used for this campaign (variables resolved per-recipient at send time)'
                )),
                ('meta_template_name', models.CharField(
                    blank=True,
                    help_text='Approved template name registered in Meta Business Manager',
                    max_length=200,
                )),
                ('meta_template_language', models.CharField(
                    blank=True,
                    default='en',
                    help_text='Language code for the Meta approved template (e.g. en, hi)',
                    max_length=20,
                )),
                ('guest_filter', models.CharField(
                    choices=[
                        ('all', 'All guests'),
                        ('not_sent', 'Not yet invited'),
                        ('rsvp_yes', 'RSVP confirmed'),
                        ('rsvp_no', 'RSVP declined'),
                        ('rsvp_maybe', 'RSVP maybe'),
                        ('rsvp_pending', 'No RSVP yet'),
                        ('relationship', 'By relationship group'),
                        ('custom_selection', 'Manually selected guests'),
                    ],
                    default='all',
                    max_length=30,
                )),
                ('filter_relationship', models.CharField(
                    blank=True,
                    help_text='Only used when guest_filter = relationship',
                    max_length=100,
                )),
                ('custom_guest_ids', models.JSONField(
                    blank=True,
                    default=list,
                    help_text='Guest PKs when guest_filter = custom_selection',
                )),
                ('scheduled_at', models.DateTimeField(
                    blank=True,
                    null=True,
                    help_text='Future UTC datetime to start sending; null = send immediately on launch',
                )),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('sending', 'Sending'),
                        ('completed', 'Completed'),
                        ('failed', 'Failed'),
                        ('cancelled', 'Cancelled'),
                    ],
                    default='pending',
                    max_length=20,
                )),
                ('total_recipients', models.IntegerField(default=0)),
                ('sent_count', models.IntegerField(default=0)),
                ('delivered_count', models.IntegerField(default=0)),
                ('read_count', models.IntegerField(default=0)),
                ('failed_count', models.IntegerField(default=0)),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='campaigns',
                    to='events.event',
                )),
                ('template', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='campaigns',
                    to='events.messagetemplate',
                )),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='created_campaigns',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'message_campaigns',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='CampaignRecipient',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone', models.CharField(max_length=20)),
                ('resolved_message', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('sent', 'Sent to Meta'),
                        ('delivered', 'Delivered to device'),
                        ('read', 'Read by recipient'),
                        ('failed', 'Failed'),
                        ('skipped', 'Skipped'),
                    ],
                    default='pending',
                    max_length=20,
                )),
                ('whatsapp_message_id', models.CharField(
                    blank=True,
                    db_index=True,
                    help_text='wamid returned by Meta Cloud API \u2014 used for webhook correlation',
                    max_length=200,
                )),
                ('error_message', models.TextField(blank=True)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('delivered_at', models.DateTimeField(blank=True, null=True)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('campaign', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='recipients',
                    to='events.messagecampaign',
                )),
                ('guest', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='campaign_recipients',
                    to='events.guest',
                )),
            ],
            options={
                'db_table': 'campaign_recipients',
                'ordering': ['created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='messagecampaign',
            index=models.Index(fields=['event', 'status'], name='campaigns_event_status_idx'),
        ),
        migrations.AddIndex(
            model_name='messagecampaign',
            index=models.Index(fields=['event', 'created_at'], name='campaigns_event_created_idx'),
        ),
        migrations.AddIndex(
            model_name='messagecampaign',
            index=models.Index(fields=['scheduled_at'], name='campaigns_scheduled_at_idx'),
        ),
        migrations.AddIndex(
            model_name='campaignrecipient',
            index=models.Index(fields=['campaign', 'status'], name='recipients_campaign_status_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='campaignrecipient',
            unique_together={('campaign', 'guest')},
        ),
    ]
