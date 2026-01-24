# Generated migration for analytics tracking models
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0039_add_custom_fields_to_rsvp'),
    ]

    operations = [
        migrations.CreateModel(
            name='InvitePageView',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('viewed_at', models.DateTimeField(auto_now_add=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invite_views', to='events.event')),
                ('guest', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='invite_views', to='events.guest')),
            ],
            options={
                'db_table': 'invite_page_views',
                'ordering': ['-viewed_at'],
            },
        ),
        migrations.CreateModel(
            name='RSVPPageView',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('viewed_at', models.DateTimeField(auto_now_add=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rsvp_views', to='events.event')),
                ('guest', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rsvp_views', to='events.guest')),
            ],
            options={
                'db_table': 'rsvp_page_views',
                'ordering': ['-viewed_at'],
            },
        ),
        migrations.AddIndex(
            model_name='invitepageview',
            index=models.Index(fields=['guest', '-viewed_at'], name='invite_views_guest_idx'),
        ),
        migrations.AddIndex(
            model_name='invitepageview',
            index=models.Index(fields=['event', '-viewed_at'], name='invite_views_event_idx'),
        ),
        migrations.AddIndex(
            model_name='rsvppageview',
            index=models.Index(fields=['guest', '-viewed_at'], name='rsvp_views_guest_idx'),
        ),
        migrations.AddIndex(
            model_name='rsvppageview',
            index=models.Index(fields=['event', '-viewed_at'], name='rsvp_views_event_idx'),
        ),
    ]
