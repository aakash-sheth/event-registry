"""
Visual style presets for the Page Layout Auto-Generator.

A "preset" bundles together everything that makes one generated layout
visually distinct from another using the SAME card and the SAME tile
sequence: fonts, texture, spacing, page border, decorative symbol, button
label style, etc. Presets are tagged with the `feelings` they fit so the
sampler can match presets to copy tones (e.g. "elegant" copy → "elegant"
preset, not "playful" preset).

All `font` ids referenced here MUST exist in
`frontend/lib/invite/fonts.ts`'s FONT_OPTIONS array. The cross-check below
runs at import time and raises if a font id has been removed from the
frontend without updating this file.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Iterable

# Mirror of the `id` values in `frontend/lib/invite/fonts.ts`. Updating the
# frontend list requires updating this set too. Kept as a constant tuple so
# the cross-check below is fast and explicit.
KNOWN_FONT_IDS = (
    # System fonts
    "helvetica", "arial", "verdana", "trebuchet-ms", "courier-new",
    "times-new-roman", "georgia", "palatino", "comic-sans-ms", "impact",
    # Google fonts
    "playfair-display", "cormorant-garamond", "lora",
    "inter", "poppins", "open-sans",
    "great-vibes", "dancing-script", "pacifico",
    "montserrat", "raleway",
)


# Allowed feeling tags. Match `dominant_feeling` enum from card_analyzer
# and `tone` enum from copy_generator. Any new feeling must be added in all
# three places.
ALLOWED_FEELINGS = (
    "romantic", "celebratory", "serene", "playful",
    "elegant", "modern", "rustic", "traditional",
    "warm", "intimate",
)


# Allowed values for the per-preset `carousel` block. These mirror the
# `EventCarouselTileSettings` literal union types in
# `frontend/lib/invite/schema.ts`. Adding a new preset? Pick from these.
_CAROUSEL_CARD_STYLES = {"minimal", "elegant", "modern", "classic"}
_CAROUSEL_CARD_LAYOUTS = {"full-width", "centered", "grid"}
_CAROUSEL_CARD_SPACINGS = {"tight", "normal", "spacious"}
_CAROUSEL_CARD_SHADOWS = {"none", "sm", "md", "lg", "xl"}
_CAROUSEL_IMAGE_HEIGHTS = {"small", "medium", "large", "full"}
_CAROUSEL_IMAGE_RATIOS = {"16:9", "4:3", "1:1", "auto"}
_CAROUSEL_PADDINGS = {"tight", "normal", "spacious"}

_BUTTON_VARIANTS = {
    "classic", "gloss", "soft", "metal", "raised",
    "glow", "bracket", "shimmer", "ornate", "link",
}
_BUTTON_RADII = {"sharp", "subtle", "round", "pill"}


_PRESETS: list[dict] = [
    {
        "id": "ivory-romance",
        "title_font": "playfair-display",
        "body_font": "lora",
        "script_font": "great-vibes",
        # Intensities below 30 are visually subliminal on phone screens
        # and disappear entirely in the scaled-down library thumbnails.
        # Tuned 35-50 so the texture actually reads as paper grain, not
        # a flat block of color.
        "texture": {"type": "linen", "intensity": 38},
        "spacing": "spacious",
        "page_border": {"enabled": True, "style": "solid", "width": 1},
        "decorative_symbol": "❦",
        "border_style": "elegant",
        "button_label_style": "RSVP",
        "button_variant": "ornate",
        "button_radius": "subtle",
        "gradient_angle": 160,
        "fits_feelings": ["romantic", "elegant", "intimate", "warm"],
        "force_dark_bg": False,
        "title_size": "xlarge",
        "carousel": {
            "cardStyle": "elegant",
            "cardLayout": "centered",
            "cardSpacing": "spacious",
            "cardShadow": "md",
            "cardBorderRadius": 16,
            "cardPadding": "spacious",
            "imageHeight": "medium",
            "imageAspectRatio": "4:3",
        },
        "decoration_pool": ["paisley-spot", "floral-rosette", "leaf-spray-top", "none"],
    },
    {
        "id": "noir-classic",
        "title_font": "playfair-display",
        "body_font": "georgia",
        "script_font": "cormorant-garamond",
        "texture": {"type": "paper-grain", "intensity": 42},
        "spacing": "normal",
        "page_border": {"enabled": True, "style": "double", "width": 2},
        "decorative_symbol": "✦",
        "border_style": "classic",
        "button_label_style": "RSVP",
        "button_variant": "metal",
        "button_radius": "sharp",
        "gradient_angle": 180,
        "fits_feelings": ["elegant", "traditional", "intimate"],
        "force_dark_bg": True,
        "title_size": "large",
        "carousel": {
            "cardStyle": "classic",
            "cardLayout": "centered",
            "cardSpacing": "normal",
            "cardShadow": "lg",
            "cardBorderRadius": 4,
            "cardPadding": "normal",
            "imageHeight": "medium",
            "imageAspectRatio": "16:9",
        },
        "decoration_pool": ["art-deco-fan", "geometric-star", "none"],
    },
    {
        "id": "garden-soiree",
        "title_font": "cormorant-garamond",
        "body_font": "lora",
        "script_font": "dancing-script",
        "texture": {"type": "vintage-paper", "intensity": 36},
        "spacing": "normal",
        "page_border": {"enabled": False},
        "decorative_symbol": "✿",
        "border_style": "ornate",
        "button_label_style": "RSVP",
        "button_variant": "soft",
        "button_radius": "round",
        "gradient_angle": 135,
        "fits_feelings": ["romantic", "rustic", "warm", "celebratory"],
        "force_dark_bg": False,
        "title_size": "large",
        "carousel": {
            "cardStyle": "elegant",
            "cardLayout": "grid",
            "cardSpacing": "normal",
            "cardShadow": "sm",
            "cardBorderRadius": 12,
            "cardPadding": "normal",
            "imageHeight": "large",
            "imageAspectRatio": "4:3",
        },
        "decoration_pool": ["leaf-spray", "leaf-spray-top", "floral-rosette", "none"],
    },
    {
        "id": "modern-minimal",
        "title_font": "montserrat",
        "body_font": "inter",
        "script_font": None,
        "texture": {"type": "none", "intensity": 0},
        "spacing": "tight",
        "page_border": {"enabled": False},
        "decorative_symbol": "—",
        "border_style": "minimal",
        "button_label_style": "RSVP",
        "button_variant": "classic",
        "button_radius": "sharp",
        "gradient_angle": 90,
        "fits_feelings": ["modern", "elegant", "serene"],
        "force_dark_bg": False,
        "title_size": "large",
        "carousel": {
            "cardStyle": "minimal",
            "cardLayout": "full-width",
            "cardSpacing": "tight",
            "cardShadow": "none",
            "cardBorderRadius": 0,
            "cardPadding": "tight",
            "imageHeight": "large",
            "imageAspectRatio": "1:1",
        },
        "decoration_pool": ["minimal-dot", "none", "none"],
    },
    {
        "id": "festival-bold",
        "title_font": "raleway",
        "body_font": "poppins",
        "script_font": "pacifico",
        "texture": {"type": "canvas", "intensity": 38},
        "spacing": "normal",
        "page_border": {"enabled": False},
        "decorative_symbol": "✤",
        "border_style": "modern",
        "button_label_style": "Join",
        "button_variant": "glow",
        "button_radius": "pill",
        "gradient_angle": 135,
        "fits_feelings": ["playful", "celebratory", "modern"],
        "force_dark_bg": False,
        "title_size": "xlarge",
        "carousel": {
            "cardStyle": "modern",
            "cardLayout": "grid",
            "cardSpacing": "spacious",
            "cardShadow": "xl",
            "cardBorderRadius": 20,
            "cardPadding": "spacious",
            "imageHeight": "full",
            "imageAspectRatio": "16:9",
        },
        "decoration_pool": ["floral-rosette", "geometric-star", "leaf-spray"],
    },
    {
        "id": "rustic-craft",
        "title_font": "lora",
        "body_font": "open-sans",
        "script_font": "dancing-script",
        "texture": {"type": "parchment", "intensity": 48},
        "spacing": "spacious",
        "page_border": {"enabled": True, "style": "dotted", "width": 2},
        "decorative_symbol": "•",
        "border_style": "vintage",
        "button_label_style": "RSVP",
        "button_variant": "raised",
        "button_radius": "subtle",
        "gradient_angle": 160,
        "fits_feelings": ["rustic", "warm", "traditional", "intimate"],
        "force_dark_bg": False,
        "title_size": "large",
        "carousel": {
            "cardStyle": "classic",
            "cardLayout": "centered",
            "cardSpacing": "spacious",
            "cardShadow": "sm",
            "cardBorderRadius": 8,
            "cardPadding": "spacious",
            "imageHeight": "medium",
            "imageAspectRatio": "4:3",
        },
        "decoration_pool": ["leaf-spray", "leaf-spray-top", "paisley-spot", "none"],
    },
    {
        "id": "satin-traditional",
        "title_font": "playfair-display",
        "body_font": "cormorant-garamond",
        "script_font": "great-vibes",
        "texture": {"type": "silk", "intensity": 40},
        "spacing": "spacious",
        "page_border": {"enabled": True, "style": "ridge", "width": 3},
        "decorative_symbol": "✦",
        "border_style": "ornate",
        "button_label_style": "RSVP",
        "button_variant": "shimmer",
        "button_radius": "subtle",
        "gradient_angle": 160,
        "fits_feelings": ["traditional", "elegant", "celebratory"],
        "force_dark_bg": False,
        "title_size": "xlarge",
        "carousel": {
            "cardStyle": "elegant",
            "cardLayout": "centered",
            "cardSpacing": "spacious",
            "cardShadow": "lg",
            "cardBorderRadius": 16,
            "cardPadding": "spacious",
            "imageHeight": "medium",
            "imageAspectRatio": "4:3",
        },
        "decoration_pool": ["art-deco-fan", "paisley-spot", "floral-rosette"],
    },
    {
        "id": "marble-modern",
        "title_font": "raleway",
        "body_font": "inter",
        "script_font": None,
        "texture": {"type": "marble", "intensity": 35},
        "spacing": "normal",
        "page_border": {"enabled": False},
        "decorative_symbol": "",
        "border_style": "modern",
        "button_label_style": "RSVP",
        "button_variant": "gloss",
        "button_radius": "round",
        "gradient_angle": 180,
        "fits_feelings": ["modern", "serene", "elegant"],
        "force_dark_bg": False,
        "title_size": "large",
        "carousel": {
            "cardStyle": "modern",
            "cardLayout": "full-width",
            "cardSpacing": "normal",
            "cardShadow": "md",
            "cardBorderRadius": 12,
            "cardPadding": "normal",
            "imageHeight": "large",
            "imageAspectRatio": "16:9",
        },
        "decoration_pool": ["minimal-dot", "geometric-star", "none"],
    },
]


# Import-time integrity check. If this raises, a frontend font id was
# removed without updating KNOWN_FONT_IDS — fix the mismatch before the
# generator can produce configs that reference missing fonts.
def _validate_presets() -> None:
    known = set(KNOWN_FONT_IDS)
    for preset in _PRESETS:
        for key in ("title_font", "body_font", "script_font"):
            font_id = preset.get(key)
            if font_id and font_id not in known:
                raise RuntimeError(
                    f"style_presets: preset {preset['id']!r} references unknown "
                    f"font id {font_id!r} (key={key}). Update KNOWN_FONT_IDS or "
                    "the preset to match frontend/lib/invite/fonts.ts."
                )
        for feeling in preset.get("fits_feelings") or []:
            if feeling not in ALLOWED_FEELINGS:
                raise RuntimeError(
                    f"style_presets: preset {preset['id']!r} references unknown "
                    f"feeling {feeling!r}. Add it to ALLOWED_FEELINGS or fix the preset."
                )
        for key, allowed in (("button_variant", _BUTTON_VARIANTS), ("button_radius", _BUTTON_RADII)):
            val = preset.get(key)
            if val and val not in allowed:
                raise RuntimeError(
                    f"style_presets: preset {preset['id']!r} {key}={val!r} "
                    f"not in allowed set {sorted(allowed)}."
                )
        carousel = preset.get("carousel")
        if not isinstance(carousel, dict):
            raise RuntimeError(
                f"style_presets: preset {preset['id']!r} is missing required "
                "`carousel` block. Add one with cardStyle/cardLayout/etc."
            )
        _validate_carousel(preset["id"], carousel)


def _validate_carousel(preset_id: str, c: dict) -> None:
    """Verify a preset's carousel block uses only schema-valid enum values."""
    checks = (
        ("cardStyle", _CAROUSEL_CARD_STYLES),
        ("cardLayout", _CAROUSEL_CARD_LAYOUTS),
        ("cardSpacing", _CAROUSEL_CARD_SPACINGS),
        ("cardShadow", _CAROUSEL_CARD_SHADOWS),
        ("imageHeight", _CAROUSEL_IMAGE_HEIGHTS),
        ("imageAspectRatio", _CAROUSEL_IMAGE_RATIOS),
        ("cardPadding", _CAROUSEL_PADDINGS),
    )
    for key, allowed in checks:
        if key not in c:
            continue
        if c[key] not in allowed:
            raise RuntimeError(
                f"style_presets: preset {preset_id!r} carousel.{key}="
                f"{c[key]!r} not in allowed set {sorted(allowed)}."
            )


def _validate_decoration_pools() -> None:
    """Cross-check every preset's decoration_pool against decorations.py.

    Imported lazily to dodge circular-import issues if decorations.py ever
    needs to read from this module.
    """
    from . import decorations as _dec
    valid_ids = {s["id"] for s in _dec.all_decoration_sets()}
    for preset in _PRESETS:
        pool = preset.get("decoration_pool") or []
        if not isinstance(pool, list) or not pool:
            raise RuntimeError(
                f"style_presets: preset {preset['id']!r} is missing required "
                "`decoration_pool` (use ['none'] if no decorations)."
            )
        for set_id in pool:
            if set_id not in valid_ids:
                raise RuntimeError(
                    f"style_presets: preset {preset['id']!r} decoration_pool "
                    f"references unknown set id {set_id!r}; valid ids: "
                    f"{sorted(valid_ids)}"
                )


_validate_presets()
_validate_decoration_pools()


def all_presets() -> list[dict]:
    return [deepcopy(p) for p in _PRESETS]


def eligible_presets(
    *,
    feeling: str | None = None,
    tone: str | None = None,
    is_dark_bg: bool = False,
) -> list[dict]:
    """Return presets whose `fits_feelings` overlap with the card feeling
    and/or copy tone. ``force_dark_bg=True`` presets are biased away from
    light-background cards.
    """
    requested: set[str] = set()
    if feeling:
        requested.add(feeling)
    if tone:
        requested.add(tone)

    out: list[dict] = []
    skipped_dark: list[dict] = []
    for preset in _PRESETS:
        if requested and not (set(preset.get("fits_feelings") or []) & requested):
            continue
        if preset.get("force_dark_bg") and not is_dark_bg:
            # Hard filter: a dark-only preset on a light card produces
            # white-on-white text. Park it in `skipped_dark` so we can fall
            # back to it ONLY if every other path is exhausted.
            skipped_dark.append(preset)
            continue
        out.append(deepcopy(preset))

    if not out:
        # First fallback: drop the feeling/tone filter (keep dark-bg filter
        # so we never produce illegible text on a light card).
        out = [
            deepcopy(p)
            for p in _PRESETS
            if not (p.get("force_dark_bg") and not is_dark_bg)
        ]
    if not out:
        # Last-resort fallback: return everything (only reachable if every
        # preset is force_dark_bg and the card is light — currently
        # impossible, but defense in depth).
        out = [deepcopy(p) for p in _PRESETS]
    return out


def preset_ids() -> Iterable[str]:
    return (p["id"] for p in _PRESETS)
