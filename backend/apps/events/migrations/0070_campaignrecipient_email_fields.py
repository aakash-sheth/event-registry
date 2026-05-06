from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0069_messagecampaign_channel'),
    ]

    operations = [
        migrations.AddField(
            model_name='campaignrecipient',
            name='email',
            field=models.EmailField(
                blank=True,
                help_text='Snapshot of guest email at send time (for email channel)',
                max_length=254,
            ),
        ),
        migrations.AddField(
            model_name='campaignrecipient',
            name='email_message_id',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='SES Message-ID — used for delivery webhook correlation',
                max_length=200,
            ),
        ),
        # phone was NOT NULL; make it blank-allowed to support email-only recipients
        migrations.AlterField(
            model_name='campaignrecipient',
            name='phone',
            field=models.CharField(blank=True, max_length=20),
        ),
    ]
