from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('events', '0057_remove_bookingschedule_active_paused_since'),
    ]

    operations = [
        migrations.AddField(
            model_name='guest',
            name='source',
            field=models.CharField(
                choices=[
                    ('manual', 'Manual'),
                    ('file_import', 'File Import (CSV/TXT/XLS/XLSX)'),
                    ('contact_import', 'Contact Import (vCard/VCF)'),
                    ('api_import', 'API Import (JSON/contact-picker)'),
                    ('form_submission', 'Form Submission (RSVP/Slot Booking)'),
                ],
                default='manual',
                db_index=True,
                help_text='Origin of guest record (manual/import/rsvp submission).',
                max_length=20,
            ),
        ),
    ]

