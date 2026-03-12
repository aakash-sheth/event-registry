"""
Fixes three analytics correctness issues:

1. Renames AnalyticsBatchRun.started_at → collection_window_start so the field
   name matches its meaning (start of the collection window, not when the batch
   process itself started).

2. Removes auto_now_add=True from InvitePageView.viewed_at and RSVPPageView.viewed_at.
   auto_now_add caused bulk_create() to override the cached timestamp with the
   batch-processing timestamp, silently corrupting all view timings.

3. Adds unique constraints on (guest, event, viewed_at) for both view tables so
   that bulk_create(ignore_conflicts=True) actually prevents duplicate inserts on
   batch retries/crashes.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0047_add_greeting_card_sample'),
    ]

    operations = [
        # --- Fix #10: rename started_at → collection_window_start ---
        # First remove the index that references started_at
        migrations.RemoveIndex(
            model_name='analyticsbatchrun',
            name='batch_runs_status_idx',
        ),
        migrations.RenameField(
            model_name='analyticsbatchrun',
            old_name='started_at',
            new_name='collection_window_start',
        ),
        migrations.AlterField(
            model_name='analyticsbatchrun',
            name='collection_window_start',
            field=models.DateTimeField(
                help_text='Start of the analytics collection window this batch covers'
            ),
        ),
        # Re-add index using the renamed field
        migrations.AddIndex(
            model_name='analyticsbatchrun',
            index=models.Index(
                fields=['status', '-collection_window_start'],
                name='batch_runs_status_idx',
            ),
        ),

        # --- Fix #11: remove auto_now_add from viewed_at ---
        # Change to a regular DateTimeField so batch inserts can store the
        # original cached timestamp rather than the batch-processing time.
        migrations.AlterField(
            model_name='invitepageview',
            name='viewed_at',
            field=models.DateTimeField(
                help_text='When the guest actually viewed the page (from cached timestamp)'
            ),
        ),
        migrations.AlterField(
            model_name='rsvppageview',
            name='viewed_at',
            field=models.DateTimeField(
                help_text='When the guest actually viewed the page (from cached timestamp)'
            ),
        ),

        # --- Fix #3: add unique constraints so ignore_conflicts=True is effective ---
        migrations.AddConstraint(
            model_name='invitepageview',
            constraint=models.UniqueConstraint(
                fields=['guest', 'event', 'viewed_at'],
                name='invite_views_unique_guest_event_time',
            ),
        ),
        migrations.AddConstraint(
            model_name='rsvppageview',
            constraint=models.UniqueConstraint(
                fields=['guest', 'event', 'viewed_at'],
                name='rsvp_views_unique_guest_event_time',
            ),
        ),
    ]
