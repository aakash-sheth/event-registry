# Generated migration - Audit font families in invite page configs (read-only)
from django.db import migrations
import re
from collections import Counter

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

def audit_font_families(apps, schema_editor):
    """
    Read-only audit of font families in all InvitePage configs.
    Collects statistics without modifying any data.
    """
    InvitePage = apps.get_model('events', 'InvitePage')
    
    total_pages = 0
    pages_with_fonts = 0
    font_counter = Counter()
    matched_fonts = Counter()
    unmatchable_fonts = set()
    fonts_by_location = {
        'title_tiles': Counter(),
        'event_carousel_tiles': Counter(),
        'custom_fonts_title': Counter(),
        'custom_fonts_body': Counter(),
    }
    
    print("\n" + "="*70)
    print("FONT FAMILY AUDIT - Read-only analysis")
    print("="*70 + "\n")
    
    for invite_page in InvitePage.objects.exclude(config={}):
        total_pages += 1
        
        if not invite_page.config or not isinstance(invite_page.config, dict):
            continue
        
        config = invite_page.config
        page_has_fonts = False
        
        # Check tiles
        if 'tiles' in config and isinstance(config['tiles'], list):
            for tile in config['tiles']:
                if not isinstance(tile, dict) or 'settings' not in tile:
                    continue
                
                settings = tile.get('settings', {})
                if not isinstance(settings, dict):
                    continue
                
                # Title tile fonts
                if tile.get('type') == 'title' and 'font' in settings:
                    font_str = settings['font']
                    if font_str:
                        page_has_fonts = True
                        font_counter[font_str] += 1
                        fonts_by_location['title_tiles'][font_str] += 1
                        
                        canonical = find_canonical_font(font_str)
                        if canonical:
                            matched_fonts[canonical] += 1
                        else:
                            unmatchable_fonts.add(font_str)
                
                # Event-carousel tile fonts
                if tile.get('type') == 'event-carousel':
                    title_styling = settings.get('subEventTitleStyling', {})
                    if isinstance(title_styling, dict) and 'font' in title_styling:
                        font_str = title_styling['font']
                        if font_str:
                            page_has_fonts = True
                            font_counter[font_str] += 1
                            fonts_by_location['event_carousel_tiles'][font_str] += 1
                            
                            canonical = find_canonical_font(font_str)
                            if canonical:
                                matched_fonts[canonical] += 1
                            else:
                                unmatchable_fonts.add(font_str)
        
        # Check legacy customFonts
        if 'customFonts' in config and isinstance(config['customFonts'], dict):
            custom_fonts = config['customFonts']
            
            if 'titleFont' in custom_fonts:
                font_str = custom_fonts['titleFont']
                if font_str:
                    page_has_fonts = True
                    font_counter[font_str] += 1
                    fonts_by_location['custom_fonts_title'][font_str] += 1
                    
                    canonical = find_canonical_font(font_str)
                    if canonical:
                        matched_fonts[canonical] += 1
                    else:
                        unmatchable_fonts.add(font_str)
            
            if 'bodyFont' in custom_fonts:
                font_str = custom_fonts['bodyFont']
                if font_str:
                    page_has_fonts = True
                    font_counter[font_str] += 1
                    fonts_by_location['custom_fonts_body'][font_str] += 1
                    
                    canonical = find_canonical_font(font_str)
                    if canonical:
                        matched_fonts[canonical] += 1
                    else:
                        unmatchable_fonts.add(font_str)
        
        if page_has_fonts:
            pages_with_fonts += 1
    
    # Print statistics
    print(f"Total invite pages scanned: {total_pages}")
    print(f"Pages with fonts: {pages_with_fonts}")
    print(f"Total font instances found: {sum(font_counter.values())}")
    print(f"Unique font strings: {len(font_counter)}")
    print()
    
    # Matched fonts breakdown
    print("="*70)
    print("MATCHED FONTS (will be normalized)")
    print("="*70)
    if matched_fonts:
        for canonical_font, count in matched_fonts.most_common():
            print(f"  {canonical_font}: {count} instance(s)")
    else:
        print("  No matched fonts found")
    print()
    
    # Unmatchable fonts
    print("="*70)
    print("UNMATCHABLE FONTS (will be preserved as-is)")
    print("="*70)
    if unmatchable_fonts:
        for font in sorted(unmatchable_fonts):
            count = font_counter[font]
            print(f"  {font}: {count} instance(s)")
    else:
        print("  No unmatchable fonts found")
    print()
    
    # Breakdown by location
    print("="*70)
    print("FONTS BY LOCATION")
    print("="*70)
    print(f"  Title tiles: {sum(fonts_by_location['title_tiles'].values())} instance(s)")
    print(f"  Event-carousel tiles: {sum(fonts_by_location['event_carousel_tiles'].values())} instance(s)")
    print(f"  Legacy customFonts.titleFont: {sum(fonts_by_location['custom_fonts_title'].values())} instance(s)")
    print(f"  Legacy customFonts.bodyFont: {sum(fonts_by_location['custom_fonts_body'].values())} instance(s)")
    print()
    
    # All fonts found (for reference)
    print("="*70)
    print("ALL FONTS FOUND (sorted by frequency)")
    print("="*70)
    if font_counter:
        for font_str, count in font_counter.most_common():
            canonical = find_canonical_font(font_str)
            status = f"→ {canonical}" if canonical else "(unmatchable)"
            print(f"  {font_str}: {count} instance(s) {status}")
    else:
        print("  No fonts found")
    print()
    
    print("="*70)
    print("AUDIT COMPLETE - No data was modified")
    print("="*70 + "\n")

def reverse_audit(apps, schema_editor):
    """Reverse migration - no-op since audit is read-only"""
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('events', '0034_add_invitation_tracking_fields'),
    ]

    operations = [
        migrations.RunPython(audit_font_families, reverse_audit),
    ]

