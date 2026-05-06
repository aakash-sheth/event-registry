from django.db import migrations, models


def backfill_campaign_channel(apps, schema_editor):
    MessageCampaign = apps.get_model('events', 'MessageCampaign')
    MessageCampaign.objects.all().update(channel='whatsapp')


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0068_messagetemplate_partial_unique'),
    ]

    operations = [
        migrations.AddField(
            model_name='messagecampaign',
            name='channel',
            field=models.CharField(
                choices=[('whatsapp', 'WhatsApp'), ('email', 'Email')],
                default='whatsapp',
                help_text='Delivery channel for this campaign',
                max_length=20,
            ),
        ),
        migrations.RunPython(backfill_campaign_channel, migrations.RunPython.noop),
    ]
