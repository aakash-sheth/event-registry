from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0037_backfill_guest_tokens_for_missing'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='timezone',
            field=models.CharField(
                default='Asia/Kolkata',
                help_text='IANA timezone name (e.g., Asia/Kolkata, America/New_York)',
                max_length=64,
            ),
        ),
    ]

