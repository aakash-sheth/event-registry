from django.db import migrations


def backfill_channel(apps, schema_editor):
    MessageTemplate = apps.get_model('events', 'MessageTemplate')
    MessageTemplate.objects.all().update(channel='whatsapp', is_live=True, meta_approved=False)


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0065_messagetemplate_email_fields_and_rename'),
    ]

    operations = [
        migrations.RunPython(backfill_channel, migrations.RunPython.noop),
    ]
