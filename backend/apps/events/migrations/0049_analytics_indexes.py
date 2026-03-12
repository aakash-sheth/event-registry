from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0048_fix_analytics_models'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='invitepageview',
            index=models.Index(
                fields=['event', 'guest'],
                name='invite_views_event_guest_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='rsvppageview',
            index=models.Index(
                fields=['event', 'guest'],
                name='rsvp_views_event_guest_idx',
            ),
        ),
    ]
