# Generated migration - Migrate mapAddress to mapUrl and set locationVerified for event-details tiles
from django.db import migrations


def migrate_map_address_to_map_url(apps, schema_editor):
    """
    Migrate existing event-details tile settings:
    1. Copy mapAddress to mapUrl if mapAddress exists and mapUrl doesn't
    2. Remove mapAddress field
    3. Set locationVerified to false if not already set (safe default)
    """
    Event = apps.get_model('events', 'Event')
    InvitePage = apps.get_model('events', 'InvitePage')
    
    updated_events = 0
    updated_invite_pages = 0
    
    # Migrate Event.page_config
    for event in Event.objects.exclude(page_config={}):
        if not event.page_config or not isinstance(event.page_config, dict):
            continue
            
        page_config = dict(event.page_config)  # Shallow copy
        updated = False
        
        # Check if page_config has tiles
        if 'tiles' in page_config and isinstance(page_config['tiles'], list):
            tiles = list(page_config['tiles'])  # Create new list
            for i, tile in enumerate(tiles):
                if not isinstance(tile, dict):
                    continue
                    
                # Only process event-details tiles
                if tile.get('type') == 'event-details' and 'settings' in tile:
                    settings = tile.get('settings', {})
                    if not isinstance(settings, dict):
                        continue
                    
                    # Create a copy of settings to modify
                    new_settings = dict(settings)
                    
                    # Migrate mapAddress to mapUrl
                    if 'mapAddress' in new_settings and 'mapUrl' not in new_settings:
                        new_settings['mapUrl'] = new_settings['mapAddress']
                        updated = True
                    
                    # Remove mapAddress field
                    if 'mapAddress' in new_settings:
                        del new_settings['mapAddress']
                        updated = True
                    
                    # Set locationVerified to false if not set (safe default)
                    if 'locationVerified' not in new_settings:
                        new_settings['locationVerified'] = False
                        updated = True
                    
                    # Update tile settings in the tiles list
                    tiles[i] = {**tile, 'settings': new_settings}
            
            # Update tiles in page_config
            if updated:
                page_config['tiles'] = tiles
        
        if updated:
            event.page_config = page_config
            event.save(update_fields=['page_config'])
            updated_events += 1
    
    # Migrate InvitePage.config
    for invite_page in InvitePage.objects.exclude(config={}):
        if not invite_page.config or not isinstance(invite_page.config, dict):
            continue
            
        config = dict(invite_page.config)  # Shallow copy
        updated = False
        
        # Check if config has tiles
        if 'tiles' in config and isinstance(config['tiles'], list):
            tiles = list(config['tiles'])  # Create new list
            for i, tile in enumerate(tiles):
                if not isinstance(tile, dict):
                    continue
                    
                # Only process event-details tiles
                if tile.get('type') == 'event-details' and 'settings' in tile:
                    settings = tile.get('settings', {})
                    if not isinstance(settings, dict):
                        continue
                    
                    # Create a copy of settings to modify
                    new_settings = dict(settings)
                    
                    # Migrate mapAddress to mapUrl
                    if 'mapAddress' in new_settings and 'mapUrl' not in new_settings:
                        new_settings['mapUrl'] = new_settings['mapAddress']
                        updated = True
                    
                    # Remove mapAddress field
                    if 'mapAddress' in new_settings:
                        del new_settings['mapAddress']
                        updated = True
                    
                    # Set locationVerified to false if not set (safe default)
                    if 'locationVerified' not in new_settings:
                        new_settings['locationVerified'] = False
                        updated = True
                    
                    # Update tile settings in the tiles list
                    tiles[i] = {**tile, 'settings': new_settings}
            
            # Update tiles in config
            if updated:
                config['tiles'] = tiles
        
        if updated:
            invite_page.config = config
            invite_page.save(update_fields=['config'])
            updated_invite_pages += 1
    
    print(f"Migration complete: Updated {updated_events} events and {updated_invite_pages} invite pages")


def reverse_migrate_map_url_to_map_address(apps, schema_editor):
    """
    Reverse migration - Not recommended as mapAddress is deprecated.
    This is a no-op as we cannot reliably reverse the migration.
    """
    # Cannot reliably reverse without knowing original mapAddress values
    # This is intentionally a no-op
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0030_add_background_color_to_sub_event'),
    ]

    operations = [
        migrations.RunPython(
            migrate_map_address_to_map_url,
            reverse_migrate_map_url_to_map_address
        ),
    ]

