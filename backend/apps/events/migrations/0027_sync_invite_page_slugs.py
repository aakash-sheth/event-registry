# Generated manually - Sync InvitePage slugs with Event slugs
from django.db import migrations


def sync_invite_page_slugs_with_events(apps, schema_editor):
    """
    Sync all InvitePage slugs with their corresponding Event slugs.
    This ensures InvitePage.slug always matches Event.slug (normalized to lowercase).
    """
    Event = apps.get_model('events', 'Event')
    InvitePage = apps.get_model('events', 'InvitePage')
    
    # Get all invite pages with their events
    invite_pages = InvitePage.objects.select_related('event').all()
    
    updated_count = 0
    for invite_page in invite_pages:
        if not invite_page.event:
            continue  # Skip if event is missing (shouldn't happen due to CASCADE)
        
        event_slug = invite_page.event.slug.lower() if invite_page.event.slug else ''
        # Only update if slug differs
        if invite_page.slug != event_slug:
            invite_page.slug = event_slug
            invite_page.save(update_fields=['slug'])
            updated_count += 1


def reverse_sync_invite_page_slugs(apps, schema_editor):
    """
    Reverse migration - cannot restore original slugs, so this is a no-op.
    The slugs were already synced, so there's nothing meaningful to reverse.
    """
    # Cannot reverse slug sync without knowing original values, so this is intentionally a no-op
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0026_normalize_slugs_to_lowercase'),
    ]

    operations = [
        migrations.RunPython(sync_invite_page_slugs_with_events, reverse_sync_invite_page_slugs),
    ]

