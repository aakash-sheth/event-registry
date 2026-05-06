from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0072_messagecampaign_subject'),
    ]

    operations = [
        migrations.AddField(
            model_name='messagecampaign',
            name='qualified_count',
            field=models.IntegerField(
                default=0,
                help_text='Guests matching the filter regardless of contact info (set at dispatch time)',
            ),
        ),
    ]
