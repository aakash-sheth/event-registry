from django.db import migrations, models
from django.db.models import Q


def backfill_single_active_link(apps, schema_editor):
    AttributionLink = apps.get_model('events', 'AttributionLink')
    db_alias = schema_editor.connection.alias

    # For each (event, target_type), keep latest active link canonical.
    seen = set()
    links = AttributionLink.objects.using(db_alias).order_by('-created_at', '-id')
    for link in links:
        key = (link.event_id, link.target_type)
        if key not in seen and link.is_active:
            seen.add(key)
            continue

        if link.is_active:
            metadata = dict(link.metadata or {})
            metadata.setdefault('legacy_redirect', True)
            metadata.setdefault('legacy_reason', 'deactivated_by_single_link_backfill')
            link.is_active = False
            link.metadata = metadata
            link.save(update_fields=['is_active', 'metadata', 'updated_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0043_add_attribution_granularity'),
    ]

    operations = [
        migrations.RunPython(backfill_single_active_link, migrations.RunPython.noop),
        migrations.RemoveConstraint(
            model_name='attributionlink',
            name='attr_links_event_guest_unique',
        ),
        migrations.AddConstraint(
            model_name='attributionlink',
            constraint=models.UniqueConstraint(
                fields=('event', 'target_type'),
                condition=Q(is_active=True),
                name='attr_links_event_target_active_unique',
            ),
        ),
    ]
