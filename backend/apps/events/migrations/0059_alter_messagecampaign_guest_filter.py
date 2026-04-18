# Generated manually to match MessageCampaign guest_filter FILTER_CHOICES extension (booking filters).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0058_add_guest_source'),
    ]

    operations = [
        migrations.AlterField(
            model_name='messagecampaign',
            name='guest_filter',
            field=models.CharField(
                choices=[
                    ('all', 'All guests'),
                    ('not_sent', 'Not yet invited'),
                    ('rsvp_yes', 'RSVP confirmed'),
                    ('rsvp_no', 'RSVP declined'),
                    ('rsvp_maybe', 'RSVP maybe'),
                    ('rsvp_pending', 'No RSVP yet'),
                    ('relationship', 'By relationship group'),
                    ('custom_selection', 'Manually selected guests'),
                    ('booking_slot', 'By booking slot'),
                    ('booking_date', 'By booking date'),
                    ('booking_status', 'By booking status'),
                ],
                default='all',
                max_length=30,
            ),
        ),
    ]
