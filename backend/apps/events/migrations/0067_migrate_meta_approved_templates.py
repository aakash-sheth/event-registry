from django.db import migrations


def migrate_meta_templates(apps, schema_editor):
    """Copy MetaApprovedTemplate rows into MessageTemplate as EkFern-owned global templates."""
    MetaApprovedTemplate = apps.get_model('events', 'MetaApprovedTemplate')
    MessageTemplate = apps.get_model('events', 'MessageTemplate')

    for mat in MetaApprovedTemplate.objects.all():
        MessageTemplate.objects.get_or_create(
            event=None,
            meta_template_name=mat.meta_template_name,
            channel='whatsapp',
            defaults=dict(
                name=mat.display_name,
                message_type=mat.message_type,
                template_text=mat.preview_text,
                description=mat.description,
                meta_approved=True,
                meta_template_language=mat.meta_template_language,
                is_live=mat.is_active,
                is_active=mat.is_active,
                created_by_id=mat.created_by_id,
            ),
        )


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0066_backfill_messagetemplate_channel'),
    ]

    operations = [
        migrations.RunPython(migrate_meta_templates, migrations.RunPython.noop),
    ]
