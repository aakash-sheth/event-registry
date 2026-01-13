# Generated migration - Normalize font families in invite page configs
from django.db import migrations
import re

# Canonical font mapping - matches frontend/lib/invite/fonts.ts
CANONICAL_FONTS = {
    # System fonts
    'helvetica': 'Helvetica, Arial, sans-serif',
    'arial': 'Arial, sans-serif',
    'verdana': 'Verdana, sans-serif',
    'trebuchet ms': 'Trebuchet MS, sans-serif',
    'courier new': 'Courier New, monospace',
    'times new roman': 'Times New Roman, serif',
    'georgia': 'Georgia, serif',
    'palatino': 'Palatino, serif',
    'comic sans ms': 'Comic Sans MS, cursive',
    'impact': 'Impact, fantasy',
    # Google Fonts
    'playfair display': "'Playfair Display', serif",
    'cormorant garamond': "'Cormorant Garamond', serif",
    'lora': "'Lora', serif",
    'inter': 'Inter, system-ui, sans-serif',
    'poppins': "'Poppins', sans-serif",
    'open sans': "'Open Sans', sans-serif",
    'great vibes': "'Great Vibes', cursive",
    'dancing script': "'Dancing Script', cursive",
    'pacifico': "'Pacifico', cursive",
    'montserrat': "'Montserrat', sans-serif",
    'raleway': "'Raleway', sans-serif",
}

def normalize_font_string(font_str):
    """Normalize font string for comparison (same logic as frontend findFontByFamily)"""
    if not font_str or not isinstance(font_str, str):
        return None
    
    # Normalize: lowercase, remove quotes, collapse spaces
    normalized = re.sub(r"['\"]", '', font_str.lower()).strip()
    normalized = re.sub(r'\s+', ' ', normalized)
    
    return normalized

def find_canonical_font(font_str):
    """Find matching canonical font by first font name"""
    if not font_str or not isinstance(font_str, str):
        return None
    
    normalized = normalize_font_string(font_str)
    if not normalized:
        return None
    
    # Extract first font name (before comma)
    first_font = normalized.split(',')[0].strip()
    
    # Find matching canonical font
    if first_font in CANONICAL_FONTS:
        return CANONICAL_FONTS[first_font]
    
    return None

def normalize_fonts_in_config(apps, schema_editor):
    """
    Normalize font families in all InvitePage configs to canonical format.
    Only normalizes fonts that match our canonical list.
    Preserves unmatchable fonts exactly as-is.
    """
    InvitePage = apps.get_model('events', 'InvitePage')
    
    updated_pages = 0
    total_fonts_normalized = 0
    unmatchable_fonts = set()
    
    print("\n" + "="*70)
    print("FONT FAMILY NORMALIZATION")
    print("="*70 + "\n")
    
    for invite_page in InvitePage.objects.exclude(config={}):
        if not invite_page.config or not isinstance(invite_page.config, dict):
            continue
        
        config = dict(invite_page.config)  # Shallow copy
        updated = False
        
        # Process tiles
        if 'tiles' in config and isinstance(config['tiles'], list):
            tiles = list(config['tiles'])  # Create new list
            for i, tile in enumerate(tiles):
                if not isinstance(tile, dict) or 'settings' not in tile:
                    continue
                
                settings = tile.get('settings', {})
                if not isinstance(settings, dict):
                    continue
                
                new_settings = dict(settings)
                
                # Normalize font in title tiles
                if tile.get('type') == 'title' and 'font' in new_settings:
                    original_font = new_settings['font']
                    if original_font:
                        canonical_font = find_canonical_font(original_font)
                        if canonical_font and canonical_font != original_font:
                            new_settings['font'] = canonical_font
                            updated = True
                            total_fonts_normalized += 1
                        elif not canonical_font:
                            # Unmatchable font - preserve as-is
                            unmatchable_fonts.add(original_font)
                
                # Normalize font in event-carousel tiles
                if tile.get('type') == 'event-carousel':
                    title_styling = new_settings.get('subEventTitleStyling', {})
                    if isinstance(title_styling, dict) and 'font' in title_styling:
                        original_font = title_styling['font']
                        if original_font:
                            canonical_font = find_canonical_font(original_font)
                            if canonical_font and canonical_font != original_font:
                                title_styling = {**title_styling, 'font': canonical_font}
                                new_settings['subEventTitleStyling'] = title_styling
                                updated = True
                                total_fonts_normalized += 1
                            elif not canonical_font:
                                # Unmatchable font - preserve as-is
                                unmatchable_fonts.add(original_font)
                
                if updated:
                    tiles[i] = {**tile, 'settings': new_settings}
            
            if updated:
                config['tiles'] = tiles
        
        # Process legacy customFonts
        if 'customFonts' in config and isinstance(config['customFonts'], dict):
            custom_fonts = dict(config['customFonts'])
            custom_fonts_updated = False
            
            if 'titleFont' in custom_fonts:
                original_font = custom_fonts['titleFont']
                if original_font:
                    canonical_font = find_canonical_font(original_font)
                    if canonical_font and canonical_font != original_font:
                        custom_fonts['titleFont'] = canonical_font
                        custom_fonts_updated = True
                        total_fonts_normalized += 1
                    elif not canonical_font:
                        unmatchable_fonts.add(original_font)
            
            if 'bodyFont' in custom_fonts:
                original_font = custom_fonts['bodyFont']
                if original_font:
                    canonical_font = find_canonical_font(original_font)
                    if canonical_font and canonical_font != original_font:
                        custom_fonts['bodyFont'] = canonical_font
                        custom_fonts_updated = True
                        total_fonts_normalized += 1
                    elif not canonical_font:
                        unmatchable_fonts.add(original_font)
            
            if custom_fonts_updated:
                config['customFonts'] = custom_fonts
                updated = True
        
        if updated:
            invite_page.config = config
            invite_page.save(update_fields=['config'])
            updated_pages += 1
    
    # Print summary
    print(f"✅ Normalized {total_fonts_normalized} font instance(s) in {updated_pages} invite page(s)")
    
    if unmatchable_fonts:
        print(f"\n⚠️  Preserved {len(unmatchable_fonts)} unmatchable font(s) as-is:")
        for font in sorted(unmatchable_fonts):
            print(f"   - {font}")
    
    print("\n" + "="*70)
    print("NORMALIZATION COMPLETE")
    print("="*70 + "\n")

def reverse_normalize_fonts(apps, schema_editor):
    """
    Reverse migration - no-op since we cannot restore original format.
    This is intentionally a no-op as we don't store original values.
    """
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('events', '0035_audit_font_families'),
    ]

    operations = [
        migrations.RunPython(normalize_fonts_in_config, reverse_normalize_fonts),
    ]

