from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0071_hostsendquota'),
    ]

    operations = [
        migrations.AddField(
            model_name='messagecampaign',
            name='subject',
            field=models.CharField(
                blank=True,
                default='',
                max_length=300,
                help_text='Email subject line (email channel only; falls back to campaign name if blank)',
            ),
        ),
    ]
