"""
Top-level orchestrator for the Page Layout Auto-Generator.

`generate_options(...)` is the only function the view layer should call.
It runs the full pipeline:

  1. Palette extraction (no LLM)
  2. Card vision analysis (LLM, cached)
  3. Copy generation (LLM, not cached)
  4. Build the eligible (recipe × preset × copy) combination space
  5. Pick N distinct combinations
  6. Compose a full ``InviteConfig`` for each
  7. Return a list of ``{config, meta}`` records — NO database writes happen
     here; the persistence layer wraps the list in a single transaction.

The generator is deterministic if a `seed` is supplied, which makes
debugging reproducible.
"""
from __future__ import annotations

import logging
import random
import uuid
from copy import deepcopy
from typing import Optional

from django.conf import settings

from . import (
    card_analyzer,
    copy_generator,
    decorations,
    palette,
    recipes,
    remix_cache,
    style_presets,
    template_naming,
    texture_variation,
)
from .metrics import emit_metric, measure_latency

logger = logging.getLogger(__name__)


# Frontend ``fonts.ts`` ID → CSS family string. Mirrors `FONT_OPTIONS`.
# Used so generated tile settings drop in the family that matches what
# `getFontFamily(id)` would produce on the client.
FONT_FAMILY_MAP: dict[str, str] = {
    "helvetica": "Helvetica, Arial, sans-serif",
    "arial": "Arial, sans-serif",
    "verdana": "Verdana, sans-serif",
    "trebuchet-ms": "Trebuchet MS, sans-serif",
    "courier-new": "Courier New, monospace",
    "times-new-roman": "Times New Roman, serif",
    "georgia": "Georgia, serif",
    "palatino": "Palatino, serif",
    "comic-sans-ms": "Comic Sans MS, cursive",
    "impact": "Impact, fantasy",
    "playfair-display": "'Playfair Display', serif",
    "cormorant-garamond": "'Cormorant Garamond', serif",
    "lora": "'Lora', serif",
    "inter": "Inter, system-ui, sans-serif",
    "poppins": "'Poppins', sans-serif",
    "open-sans": "'Open Sans', sans-serif",
    "great-vibes": "'Great Vibes', cursive",
    "dancing-script": "'Dancing Script', cursive",
    "pacifico": "'Pacifico', cursive",
    "montserrat": "'Montserrat', sans-serif",
    "raleway": "'Raleway', sans-serif",
}


# Minimum readable font sizes when overlays are clamped into tiny quiet
# regions. Keeps generated layouts presentable rather than illegible.
MIN_OVERLAY_FONT_PX = 16
DEFAULT_TITLE_FONT_PX = 48
DEFAULT_SUBTITLE_FONT_PX = 22
DEFAULT_TERTIARY_FONT_PX = 16


def _font_family(font_id: Optional[str], fallback: str = "playfair-display") -> str:
    """Resolve a font id to a CSS family string with a safe fallback.

    If a preset references a font id that is somehow not in the map (would
    be caught at import time, but defense in depth), we fall back to the
    library default rather than emit garbage.
    """
    if font_id and font_id in FONT_FAMILY_MAP:
        return FONT_FAMILY_MAP[font_id]
    return FONT_FAMILY_MAP.get(fallback, "'Playfair Display', serif")


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def recipe_structure_fingerprint(recipe: dict) -> str:
    """Stable structural id for sampling diversity (sequence + overlay mode)."""
    seq = recipe.get("tile_sequence") or []
    ov = recipe.get("overlay_strategy") or ""
    return f"{ov}|{','.join(seq)}"


def rank_eligible_recipes(
    eligible: list[dict],
    card_analysis: dict,
) -> list[dict]:
    """Order recipes using vision hints (no extra LLM). Lower sort key = earlier."""
    if not eligible or not card_analysis:
        return list(eligible)

    placement = str(card_analysis.get("best_text_placement") or "").lower().strip()
    composition = str(card_analysis.get("composition") or "").lower().strip()
    prefer_below = placement in ("below-card", "overlay-bottom-banner")
    busy = composition in ("busy", "has_baked_text")

    def sort_key(r: dict) -> tuple[int, str]:
        strat = str(r.get("overlay_strategy") or "")
        badness = 0
        if prefer_below and strat in ("full_overlay", "light_overlay"):
            badness += 2
        if busy and strat in ("full_overlay", "light_overlay"):
            badness += 1
        rid = str(r.get("id") or "")
        return (badness, rid)

    return sorted(eligible, key=sort_key)


# ---------------------------------------------------------------------------
# Sampling
# ---------------------------------------------------------------------------

def sample_combinations(
    *,
    eligible_recipes_list: list[dict],
    eligible_presets_list: list[dict],
    copy_variants: list[dict],
    n_outputs: int,
    rng: random.Random,
) -> list[dict]:
    """Pick `n_outputs` distinct (recipe, preset, copy) triples.

    Strategy:
      1. Build the full cartesian space, weighted by recipe weight.
      2. Shuffle and walk it greedily, requiring distinctness on
         (recipe.id, preset.id) and a different copy index when possible.
      3. Prefer unseen recipe_structure_fingerprint when possible so drafts
         diverge in tile skeleton, not only preset/copy.
      4. If the unique space is smaller than `n_outputs`, fall back to
         repeating recipes with different style/copy combos and tag the
         meta so staff can see the constraint was hit.
    """
    if not eligible_recipes_list:
        return []
    if not eligible_presets_list:
        eligible_presets_list = style_presets.all_presets()
    if not copy_variants:
        # Defensive: a missing copy variant is a bug, but degrade gracefully.
        # No merge tokens — these would render as literal "{{NAMES}}" in the
        # host's preview if they ever leaked into a saved template.
        copy_variants = [
            {"primary": "You're Invited", "secondary": "Join us to celebrate", "tertiary": "", "tone": "elegant"}
        ]

    triples: list[tuple[dict, dict, int]] = []
    for r in eligible_recipes_list:
        for p in eligible_presets_list:
            # Bias copy variant choice toward those whose tone matches preset feelings.
            preset_feelings = set(p.get("fits_feelings") or [])
            for ci, c in enumerate(copy_variants):
                tone = (c.get("tone") or "").lower()
                weight = float(r.get("weight", 1.0)) * (
                    1.5 if tone and tone in preset_feelings else 1.0
                )
                triples.append((r, p, ci))
                # Use weight via duplication-on-shuffle: append again proportional
                # to weight so the random walk picks heavier items more often.
                if weight > 1.2:
                    triples.append((r, p, ci))

    rng.shuffle(triples)

    def _greedy_pass(
        triples_list: list[tuple[dict, dict, int]],
        *,
        require_fresh_fingerprint: bool,
        allow_fallback_meta: bool,
        initial_chosen: list[dict],
        initial_seen_pairs: set[tuple[str, str]],
        initial_seen_copy: set[int],
        initial_seen_fp: set[str],
    ) -> tuple[list[dict], set[tuple[str, str]], set[int], set[str], int]:
        seen_pairs = set(initial_seen_pairs)
        seen_copy = set(initial_seen_copy)
        seen_fp = set(initial_seen_fp)
        chosen = list(initial_chosen)
        fallbacks = 0
        for r, p, ci in triples_list:
            if len(chosen) >= n_outputs:
                break
            fp = recipe_structure_fingerprint(r)
            pair_key = (r["id"], p["id"])
            copy_used = ci in seen_copy
            if pair_key in seen_pairs:
                continue
            if len(chosen) < len(copy_variants) and copy_used:
                continue
            if require_fresh_fingerprint and fp in seen_fp:
                continue
            seen_pairs.add(pair_key)
            seen_copy.add(ci)
            seen_fp.add(fp)
            entry: dict = {"recipe": r, "preset": p, "copy_idx": ci}
            if allow_fallback_meta:
                entry["fallback"] = True
                fallbacks += 1
            chosen.append(entry)
        return chosen, seen_pairs, seen_copy, seen_fp, fallbacks

    seen_pairs: set[tuple[str, str]] = set()
    seen_copy: set[int] = set()
    seen_fp: set[str] = set()
    chosen: list[dict] = []
    fallbacks_used = 0

    chosen, seen_pairs, seen_copy, seen_fp, _ = _greedy_pass(
        triples,
        require_fresh_fingerprint=True,
        allow_fallback_meta=False,
        initial_chosen=[],
        initial_seen_pairs=seen_pairs,
        initial_seen_copy=seen_copy,
        initial_seen_fp=seen_fp,
    )

    if len(chosen) < n_outputs:
        chosen, seen_pairs, seen_copy, seen_fp, extra_fb = _greedy_pass(
            triples,
            require_fresh_fingerprint=False,
            allow_fallback_meta=False,
            initial_chosen=chosen,
            initial_seen_pairs=seen_pairs,
            initial_seen_copy=seen_copy,
            initial_seen_fp=seen_fp,
        )
        fallbacks_used += extra_fb

    # Relax (recipe, preset) uniqueness if we still need more rows.
    if len(chosen) < n_outputs:
        seen_full: set[tuple[str, str, int]] = {
            (c["recipe"]["id"], c["preset"]["id"], c["copy_idx"]) for c in chosen
        }
        for r, p, ci in triples:
            if len(chosen) >= n_outputs:
                break
            key = (r["id"], p["id"], ci)
            if key in seen_full:
                continue
            seen_full.add(key)
            chosen.append({"recipe": r, "preset": p, "copy_idx": ci, "fallback": True})
            fallbacks_used += 1

    if fallbacks_used:
        logger.info(
            "[layout_generator] sampler used %d fallback combinations to reach n=%d",
            fallbacks_used, n_outputs,
        )

    return chosen[:n_outputs]


# ---------------------------------------------------------------------------
# Overlay placement
# ---------------------------------------------------------------------------

def _clamp_font_size_to_region(
    desired_px: int,
    *,
    region_height_pct: int,
    region_width_pct: int,
    text_length: int,
) -> int:
    """Clamp font size so text fits in the region without overflowing.

    Heuristic — invite cards render in a 9:16 frame ~360x640 px; 1% of
    height ≈ 6.4 px. A line at ~`desired_px` should fit roughly
    `region_height_pct * 0.6` percent in vertical space; we clamp to a
    minimum of ``MIN_OVERLAY_FONT_PX`` so text stays readable.
    """
    if region_height_pct <= 0 or region_width_pct <= 0:
        return MIN_OVERLAY_FONT_PX
    # Approximate: each percentage point of height ~= 6 px in our 9:16 frame.
    height_budget_px = region_height_pct * 6
    # Cap by height budget but never below MIN_OVERLAY_FONT_PX.
    sized = min(desired_px, max(height_budget_px, MIN_OVERLAY_FONT_PX))
    # Width-based cap: avoid 12 chars in a 10% wide region at 64 px.
    if text_length > 0:
        width_budget_px = region_width_pct * 3.6  # rough char-width ~= 0.5em
        per_char_budget = width_budget_px / max(1, text_length)
        sized = min(sized, max(int(per_char_budget * 1.7), MIN_OVERLAY_FONT_PX))
    return max(int(sized), MIN_OVERLAY_FONT_PX)


def build_overlays(
    *,
    quiet_regions: list[dict],
    copy: dict,
    preset: dict,
    palette_data: dict,
    overlay_strategy: str,
) -> tuple[list[dict], list[str]]:
    """Translate copy + quiet regions into TextOverlay entries.

    Returns (overlays, warnings). Warnings explain anything the staff
    reviewer should look out for (e.g. region too small).
    """
    if overlay_strategy not in ("light_overlay", "full_overlay"):
        return [], []

    overlays: list[dict] = []
    warnings: list[str] = []

    title_color_hint = "#FFFFFF" if palette_data.get("is_dark_bg") else "#1F1B16"

    # Match quiet region 'text_color' ('light'/'dark') to a hex.
    def _hex_for(region: dict) -> str:
        return "#FFFFFF" if region.get("text_color") == "light" else "#1F1B16"

    title_text = (copy.get("primary") or "").strip()
    sub_text = (copy.get("secondary") or "").strip()
    tert_text = (copy.get("tertiary") or "").strip()

    title_font = _font_family(preset.get("title_font"))
    body_font = _font_family(preset.get("body_font"))

    # 1) Title region — prefer purpose='title' or 'names', else first.
    title_region = next(
        (r for r in quiet_regions if r.get("purpose") in ("title", "names")),
        quiet_regions[0] if quiet_regions else None,
    )
    if title_region and title_text:
        size = _clamp_font_size_to_region(
            DEFAULT_TITLE_FONT_PX,
            region_height_pct=title_region["height"],
            region_width_pct=title_region["width"],
            text_length=len(title_text),
        )
        if size < DEFAULT_TITLE_FONT_PX * 0.6:
            warnings.append(
                f"Title region {title_region['width']}x{title_region['height']}% "
                "is small; font auto-clamped."
            )
        overlays.append(
            {
                "id": _new_id("ovl"),
                "text": title_text,
                "x": title_region["x"],
                "y": title_region["y"],
                "width": title_region["width"],
                "height": title_region["height"],
                "fontFamily": title_font,
                "fontSize": size,
                "color": _hex_for(title_region) or title_color_hint,
                "bold": False,
                "italic": False,
                "underline": False,
                "strikethrough": False,
                "textAlign": "center",
                "verticalAlign": "middle",
            }
        )

    # 2) Date / venue region — only used in full_overlay.
    if overlay_strategy == "full_overlay":
        sub_region = next(
            (r for r in quiet_regions if r.get("purpose") in ("date", "venue")),
            None,
        )
        # If not flagged but multiple regions exist, pick the second-largest.
        if not sub_region and len(quiet_regions) > 1:
            others = [r for r in quiet_regions if r is not title_region]
            others.sort(key=lambda r: r["width"] * r["height"], reverse=True)
            sub_region = others[0] if others else None
        if sub_region and sub_text:
            size = _clamp_font_size_to_region(
                DEFAULT_SUBTITLE_FONT_PX,
                region_height_pct=sub_region["height"],
                region_width_pct=sub_region["width"],
                text_length=len(sub_text),
            )
            overlays.append(
                {
                    "id": _new_id("ovl"),
                    "text": sub_text,
                    "x": sub_region["x"],
                    "y": sub_region["y"],
                    "width": sub_region["width"],
                    "height": sub_region["height"],
                    "fontFamily": body_font,
                    "fontSize": size,
                    "color": _hex_for(sub_region),
                    "bold": False,
                    "italic": False,
                    "underline": False,
                    "strikethrough": False,
                    "textAlign": "center",
                    "verticalAlign": "middle",
                }
            )

    return overlays, warnings


# ---------------------------------------------------------------------------
# Tile builders
# ---------------------------------------------------------------------------

def _tile_title(*, order: int, copy: dict, preset: dict, palette_data: dict, overlay_target: Optional[str] = None) -> dict:
    color = "#FFFFFF" if palette_data.get("is_dark_bg") else palette_data.get("text", "#1F1B16")
    # Fallback is a generic invitation phrase, never a merge token; saved
    # templates that carry ``{{NAMES}}`` literals look broken in preview.
    settings_payload: dict = {
        "text": (copy.get("primary") or "You're Invited").strip() or "You're Invited",
        "font": _font_family(preset.get("title_font")),
        "color": color,
        "size": preset.get("title_size", "large"),
    }
    sub = (copy.get("secondary") or "").strip()
    if sub:
        settings_payload["subtitle"] = sub
        settings_payload["subtitleFont"] = _font_family(preset.get("body_font"))
        settings_payload["subtitleColor"] = color
        settings_payload["subtitleSize"] = "medium"
    tile: dict = {
        "id": _new_id("tile-title"),
        "type": "title",
        "enabled": True,
        "order": order,
        "settings": settings_payload,
    }
    if overlay_target:
        tile["overlayTargetId"] = overlay_target
        settings_payload["overlayPosition"] = {"x": 50, "y": 50}
    return tile


def _tile_greeting_card(*, order: int, src: str, overlays: list[dict]) -> dict:
    # Aspect-fit choice: when overlays are present the text positions are in
    # 9:16 frame coords, so the card MUST fill that frame ('cover') or the
    # text would sit on the letterbox bars. When there are no overlays
    # ('none' / 'banner_below' / 'separate_title' recipes) we use 'contain'
    # so a non-9:16 user-uploaded card renders fully without baked-in
    # titles getting cropped at the sides.
    fit = "cover" if overlays else "contain"
    return {
        "id": _new_id("tile-greeting-card"),
        "type": "greeting-card",
        "enabled": True,
        "order": order,
        "settings": {
            "src": src,
            "textOverlays": overlays,
            "imageFit": fit,
        },
    }


def _tile_timer(*, order: int, palette_data: dict, preset: dict) -> dict:
    accent = palette_data.get("accent", "#A6815B")
    text_color = "#FFFFFF" if palette_data.get("is_dark_bg") else palette_data.get("text", "#1F1B16")
    return {
        "id": _new_id("tile-timer"),
        "type": "timer",
        "enabled": True,
        "order": order,
        "settings": {
            "enabled": True,
            "format": "circle",
            "circleColor": accent,
            "textColor": text_color,
        },
    }


def _tile_event_details(*, order: int, palette_data: dict, preset: dict) -> dict:
    text_color = "#FFFFFF" if palette_data.get("is_dark_bg") else palette_data.get("text", "#1F1B16")
    return {
        "id": _new_id("tile-event-details"),
        "type": "event-details",
        "enabled": True,
        "order": order,
        "settings": {
            "location": "",
            "date": "",
            "fontColor": text_color,
            "buttonColor": palette_data.get("accent", "#A6815B"),
            "borderStyle": preset.get("border_style", "elegant"),
            "borderColor": palette_data.get("muted", "#6B5F52"),
            "decorativeSymbol": preset.get("decorative_symbol", ""),
            "dateLayout": "single-line",
        },
    }


def _tile_description(*, order: int, copy: dict, palette_data: dict) -> dict:
    text_color = "#FFFFFF" if palette_data.get("is_dark_bg") else palette_data.get("text", "#1F1B16")
    line = (copy.get("tertiary") or "").strip() or "We can't wait to celebrate with you."
    return {
        "id": _new_id("tile-description"),
        "type": "description",
        "enabled": True,
        "order": order,
        "settings": {
            "content": f"<p>{line}</p>",
            "fontColor": text_color,
        },
    }


def _derive_gradient(palette_data: dict, rng: random.Random) -> str | None:
    """Build a gradient from image-extracted palette colors at a random angle.

    Uses the card's own bg and muted tones so the page background is always
    harmonious with the card image rather than a fixed preset color.
    Falls back to None (solid bg) if the palette doesn't have two usable colors.
    """
    bg = palette_data.get("bg", "").strip()
    muted = palette_data.get("muted", "").strip()
    if not bg or not muted or bg == muted:
        return None
    angle = rng.randint(45, 300)
    return f"linear-gradient({angle}deg, {bg} 0%, {muted} 100%)"


def _tile_feature_buttons(*, order: int, palette_data: dict, preset: dict) -> dict:
    settings: dict = {
        "buttonColor": palette_data.get("accent", "#A6815B"),
        "rsvpLabel": preset.get("button_label_style", "RSVP"),
        "registryLabel": "Registry",
    }
    if variant := preset.get("button_variant"):
        settings["buttonVariant"] = variant
    if radius := preset.get("button_radius"):
        settings["buttonRadius"] = radius
    return {
        "id": _new_id("tile-feature-buttons"),
        "type": "feature-buttons",
        "enabled": True,
        "order": order,
        "settings": settings,
    }


def _tile_footer(*, order: int, copy: dict, palette_data: dict) -> dict:
    text_color = palette_data.get("muted", "#6B5F52")
    # Generic, evergreen fallback — no merge tokens. The host can override
    # this in the editor with their actual sign-off.
    text = (copy.get("tertiary") or "").strip() or "With love, your hosts"
    return {
        "id": _new_id("tile-footer"),
        "type": "footer",
        "enabled": True,
        "order": order,
        "settings": {"text": text, "fontColor": text_color},
    }


def _tile_event_carousel(*, order: int, preset: dict, palette_data: dict) -> dict:
    text_color = "#FFFFFF" if palette_data.get("is_dark_bg") else palette_data.get("text", "#1F1B16")
    # Carousel styling is now driven by the preset so each generated layout
    # produces a visually distinct sub-events block (modern-minimal renders
    # full-width 1:1 cards; festival-bold renders shadowed grid cards). The
    # `_validate_presets` import-time check guarantees every preset has a
    # carousel block, so .get with defaults is a soft fallback only.
    c = preset.get("carousel") or {}
    return {
        "id": _new_id("tile-event-carousel"),
        "type": "event-carousel",
        "enabled": True,
        "order": order,
        "settings": {
            "showFields": {"image": True, "title": True, "dateTime": True, "location": True, "cta": True},
            "autoPlay": True,
            "autoPlayInterval": 5000,
            "showArrows": True,
            "showDots": True,
            "cardStyle": c.get("cardStyle", "elegant"),
            "cardLayout": c.get("cardLayout", "centered"),
            "cardSpacing": c.get("cardSpacing", "normal"),
            "cardBackgroundColor": "#FFFFFF" if not palette_data.get("is_dark_bg") else "#1A1A1A",
            "cardBorderRadius": int(c.get("cardBorderRadius", 12)),
            "cardShadow": c.get("cardShadow", "md"),
            "cardPadding": c.get("cardPadding", "normal"),
            "imageHeight": c.get("imageHeight", "medium"),
            "imageAspectRatio": c.get("imageAspectRatio", "16:9"),
            "subEventTitleStyling": {
                "font": _font_family(preset.get("title_font")),
                "color": text_color,
                "size": "medium",
            },
            "subEventDetailsStyling": {"fontColor": text_color},
        },
    }


def _tile_image(*, order: int, src: str, overlays: Optional[list] = None) -> dict:
    """Image tile hero. With text overlays, use full-image + 9:16 coords (matches ImageTile client)."""
    ovs = overlays or []
    if ovs:
        settings: dict = {
            "src": src,
            "textOverlays": ovs,
            "fitMode": "full-image",
        }
    else:
        settings = {"src": src, "fitMode": "fit-to-screen"}
    return {
        "id": _new_id("tile-image"),
        "type": "image",
        "enabled": True,
        "order": order,
        "settings": settings,
    }


# ---------------------------------------------------------------------------
# Composer
# ---------------------------------------------------------------------------

def compose_config(
    *,
    card_url: str,
    card_analysis: dict,
    palette_data: dict,
    recipe: dict,
    preset: dict,
    copy: dict,
    decoration_set: Optional[dict] = None,
    rng: Optional[random.Random] = None,
) -> tuple[dict, list[str]]:
    """Build a full ``InviteConfig`` JSON for the given combination.

    Returns (config, warnings). Warnings bubble up into ``meta`` so staff
    can see if e.g. an overlay was clamped or a tile substituted.
    """
    warnings: list[str] = []

    overlays, ovl_warns = build_overlays(
        quiet_regions=card_analysis.get("quiet_regions") or [],
        copy=copy,
        preset=preset,
        palette_data=palette_data,
        overlay_strategy=recipe["overlay_strategy"],
    )
    warnings.extend(ovl_warns)

    tiles: list[dict] = []
    order = 0
    card_tile_id: Optional[str] = None
    title_tile_added = False

    sequence = list(recipe["tile_sequence"])

    for tile_type in sequence:
        if tile_type == "greeting-card":
            tile = _tile_greeting_card(order=order, src=card_url, overlays=overlays)
            card_tile_id = tile["id"]
            tiles.append(tile)
        elif tile_type == "image":
            tile = _tile_image(order=order, src=card_url, overlays=overlays)
            card_tile_id = tile["id"]
            tiles.append(tile)
        elif tile_type == "title":
            # Banner-below: title is its own tile after the card.
            # Separate-title / none: standalone title tile, no overlay target.
            target = None
            if recipe["overlay_strategy"] == "banner_below" and card_tile_id:
                # Title sits AFTER the card and reads as a banner under it; no overlay target.
                target = None
            tiles.append(_tile_title(
                order=order, copy=copy, preset=preset,
                palette_data=palette_data, overlay_target=target,
            ))
            title_tile_added = True
        elif tile_type == "timer":
            tiles.append(_tile_timer(order=order, palette_data=palette_data, preset=preset))
        elif tile_type == "event-details":
            tiles.append(_tile_event_details(order=order, palette_data=palette_data, preset=preset))
        elif tile_type == "description":
            tiles.append(_tile_description(order=order, copy=copy, palette_data=palette_data))
        elif tile_type == "feature-buttons":
            tiles.append(_tile_feature_buttons(order=order, palette_data=palette_data, preset=preset))
        elif tile_type == "footer":
            tiles.append(_tile_footer(order=order, copy=copy, palette_data=palette_data))
        elif tile_type == "event-carousel":
            tiles.append(_tile_event_carousel(order=order, preset=preset, palette_data=palette_data))
        else:
            warnings.append(f"Skipped unknown tile type {tile_type!r} in recipe {recipe['id']}")
            continue
        order += 1

    # Edge case: a `light_overlay`/`full_overlay` recipe whose card has zero
    # quiet regions slipped through eligibility (shouldn't happen, but defense).
    # If overlays list is empty AND no separate title tile was added, prepend
    # one so the page isn't titleless.
    if (
        recipe["overlay_strategy"] in ("light_overlay", "full_overlay")
        and not overlays
        and not title_tile_added
    ):
        warnings.append(
            "No quiet regions found; promoted overlay-style recipe to a "
            "separate title tile to avoid a titleless page."
        )
        # Insert title at position 0 and bump other orders.
        for t in tiles:
            t["order"] = t["order"] + 1
        title_tile = _tile_title(order=0, copy=copy, preset=preset, palette_data=palette_data)
        tiles.insert(0, title_tile)

    config = {
        "themeId": "minimal-ivory",  # legacy fallback; overridden by customColors
        "customColors": {
            "backgroundColor": palette_data.get("bg", "#FFFFFF"),
            "backgroundGradient": _derive_gradient(palette_data, rng or random.Random()),
            "fontColor": palette_data.get("text", "#1F1B16"),
            "primaryColor": palette_data.get("accent", "#A6815B"),
            "mutedColor": palette_data.get("muted", "#6B5F52"),
        },
        "customFonts": {
            "titleFont": _font_family(preset.get("title_font")),
            "bodyFont": _font_family(preset.get("body_font")),
        },
        "texture": deepcopy(preset.get("texture") or {"type": "none", "intensity": 0}),
        "spacing": preset.get("spacing", "normal"),
        "tileSetComplete": True,
        "tiles": tiles,
        "animations": {"envelope": True, "tileViewportFade": True},
    }

    page_border = preset.get("page_border") or {}
    if page_border.get("enabled"):
        config["pageBorder"] = {
            "enabled": True,
            "style": page_border.get("style", "solid"),
            "color": palette_data.get("muted", "#D1D5DB"),
            "width": int(page_border.get("width", 1) or 1),
        }

    # Corner decorations are populated only when the sampler actually picked a
    # non-empty set. The renderer at LivingPosterPage.tsx hides the corner
    # layer when every corner is missing, so we can drop the field entirely
    # for the "none" set rather than emit four empty strings.
    if decoration_set:
        corners = decoration_set.get("corners") or {}
        clean_corners = {k: v for k, v in corners.items() if v}
        if clean_corners:
            config["cornerDecorations"] = clean_corners

    return config, warnings


# ---------------------------------------------------------------------------
# Top-level entry point
# ---------------------------------------------------------------------------

def generate_options(
    *,
    card_url: str,
    event_type: str,
    concept: str,
    user,
    request_id: str,
    n_outputs: int = 10,
    has_sub_events: bool = False,
    seed: Optional[int] = None,
) -> dict:
    """Run the full pipeline and return drafts (no DB writes)."""
    if not card_url:
        raise ValueError("card_url is required")
    if not event_type:
        raise ValueError("event_type is required")

    n_outputs = max(1, min(int(n_outputs or 10), 15))
    rng = random.Random(seed) if seed is not None else random.Random()
    metric_status = "success"
    fallback_count = 0

    with measure_latency() as elapsed_ms:
        try:
            return_value, fallback_count = _generate_options_inner(
                card_url=card_url,
                event_type=event_type,
                concept=concept,
                user=user,
                request_id=request_id,
                n_outputs=n_outputs,
                has_sub_events=has_sub_events,
                rng=rng,
                seed=seed,
            )
        except Exception:
            metric_status = "error"
            raise
        finally:
            emit_metric(
                "layout_generator.generate",
                request_id=request_id,
                latency_ms=elapsed_ms(),
                n_outputs=n_outputs,
                event_type=event_type,
                status=metric_status,
                user_id=getattr(user, "id", None),
                fallback_count=fallback_count,
                seed=seed,
            )
    return return_value


def _generate_options_inner(
    *,
    card_url: str,
    event_type: str,
    concept: str,
    user,
    request_id: str,
    n_outputs: int,
    has_sub_events: bool,
    rng: random.Random,
    seed: Optional[int] = None,
) -> tuple[dict, int]:
    """Body of ``generate_options`` extracted so the wrapper can wrap a single
    try/finally around it for metric emission. Returns (response, fallback_count)
    so the metric line can include how often the sampler had to backfill.
    """
    palette_data = palette.extract_palette(card_url)

    # 2. Vision (LLM, cached)
    card_analysis = card_analyzer.analyze_card(
        image_url=card_url,
        request_id=request_id,
        user=user,
        metadata={"event_type": event_type},
    )

    # 3. Copy (LLM, not cached)
    copy_variants = copy_generator.generate_copy_variants(
        event_type=event_type,
        concept=concept,
        card_analysis=card_analysis,
        request_id=request_id,
        user=user,
        n_variants=min(n_outputs, 8),
    )

    # 4. Eligible recipes/presets
    quiet_regions = card_analysis.get("quiet_regions") or []
    has_baked_text = bool(card_analysis.get("has_baked_text"))
    eligible_recipes_list = recipes.eligible_recipes(
        event_type=event_type,
        quiet_region_count=len(quiet_regions),
        has_baked_text=has_baked_text,
        has_sub_events=has_sub_events,
    )
    eligible_recipes_list = rank_eligible_recipes(eligible_recipes_list, card_analysis)
    eligible_presets_list = style_presets.eligible_presets(
        feeling=card_analysis.get("dominant_feeling"),
        is_dark_bg=palette_data.get("is_dark_bg", False),
    )

    # 5. Sample
    combos = sample_combinations(
        eligible_recipes_list=eligible_recipes_list,
        eligible_presets_list=eligible_presets_list,
        copy_variants=copy_variants,
        n_outputs=n_outputs,
        rng=rng,
    )

    # 6. Compose — each draft gets a distinct page bg from vision + colorthief
    # (effective_palette_variation rotates through suggested_page_bg_palette).
    drafts: list[dict] = []
    fallback_count = 0
    for draft_index, combo in enumerate(combos):
        copy = copy_variants[combo["copy_idx"] % len(copy_variants)]
        decoration_set = decorations.pick_decoration_set(
            preset=combo["preset"],
            feeling=card_analysis.get("dominant_feeling"),
            rng=rng,
        )
        effective_palette = palette.effective_palette_variation(
            palette_data, card_analysis, draft_index,
        )
        config, warnings = compose_config(
            card_url=card_url,
            card_analysis=card_analysis,
            palette_data=effective_palette,
            recipe=combo["recipe"],
            preset=combo["preset"],
            copy=copy,
            decoration_set=decoration_set,
            rng=rng,
        )
        tex = texture_variation.apply_texture_variation(
            config,
            draft_index=draft_index,
            card_analysis=card_analysis,
            copy=copy,
            seed=seed,
            request_id=request_id,
        )
        is_fallback = bool(combo.get("fallback"))
        if is_fallback:
            fallback_count += 1
        meta = {
            "recipe_id": combo["recipe"]["id"],
            "preset_id": combo["preset"]["id"],
            "tone": copy.get("tone"),
            "overlay_strategy": combo["recipe"]["overlay_strategy"],
            "card_feeling": card_analysis.get("dominant_feeling"),
            "card_style": card_analysis.get("visual_style"),
            "card_composition": card_analysis.get("composition"),
            "has_baked_text": has_baked_text,
            "fallback": is_fallback,
            "warnings": warnings,
            "copy_notes": copy.get("notes", ""),
            "copy_headline": template_naming.copy_headline_snippet(copy.get("primary")),
            "decoration_set_id": (decoration_set or {}).get("id"),
            "page_background_color": effective_palette.get("bg"),
            "structure_fingerprint": recipe_structure_fingerprint(combo["recipe"]),
            "texture_type": tex.get("type"),
            "texture_intensity": tex.get("intensity"),
        }
        drafts.append({"config": config, "meta": meta})

    # Snapshot the LLM-derived data so a follow-up remix can short-circuit
    # the vision + copy calls. This is best-effort — a cache miss simply
    # forces the remix endpoint to fall back to a full generate_options run.
    try:
        remix_cache.store(
            request_id=request_id,
            payload={
                "card_url": card_url,
                "event_type": event_type,
                "concept": concept,
                "has_sub_events": has_sub_events,
                "card_analysis": card_analysis,
                "copy_variants": copy_variants,
                "palette": palette_data,
            },
        )
    except Exception:
        logger.exception(
            "[generate_options] remix snapshot write failed (non-fatal) "
            "for request_id=%s", request_id,
        )

    response = {
        "drafts": drafts,
        "card_analysis_summary": {
            "composition": card_analysis.get("composition"),
            "visual_style": card_analysis.get("visual_style"),
            "dominant_feeling": card_analysis.get("dominant_feeling"),
            "has_baked_text": has_baked_text,
            "quiet_region_count": len(quiet_regions),
            "suggested_page_bg_palette": card_analysis.get(
                "suggested_page_bg_palette",
            ),
            "bg_lightness_preference": card_analysis.get(
                "bg_lightness_preference",
            ),
        },
        "palette": palette_data,
    }
    return response, fallback_count


# ---------------------------------------------------------------------------
# Remix entry point
# ---------------------------------------------------------------------------

def remix_options(
    *,
    parent_request_id: str,
    user,
    request_id: str,
    n_outputs: int = 10,
    seed: Optional[int] = None,
    lock_recipe_id: Optional[str] = None,
    lock_preset_id: Optional[str] = None,
    lock_copy_idx: Optional[int] = None,
) -> dict:
    """Resample the layout space using cached vision + copy from a parent run.

    The expensive work is the LLM calls; the cheap work is the
    recipe × preset × copy sampling and `compose_config`. ``remix_options``
    keeps only the cheap work, so a remix is essentially free of provider
    cost (the underlying ledger rows are still written for observability,
    but with ``cache_hit=True`` and ``cost_usd=0``).

    Optional locks let staff pin specific dimensions:
      * ``lock_recipe_id`` — only sample from this one recipe.
      * ``lock_preset_id`` — only sample from this one preset.
      * ``lock_copy_idx`` — every draft uses the same copy variant.

    Raises ``ValueError`` if the parent snapshot has expired or is missing,
    or if a lock id doesn't resolve to anything.
    """
    if not parent_request_id:
        raise ValueError("parent_request_id is required.")
    snapshot = remix_cache.fetch(parent_request_id)
    if snapshot is None:
        raise ValueError(
            f"No cached snapshot for request_id={parent_request_id!r}. "
            "It may have expired or been evicted; run a fresh generation."
        )

    n_outputs = max(1, min(int(n_outputs or 10), 15))
    rng = random.Random(seed) if seed is not None else random.Random()

    card_url = snapshot["card_url"]
    event_type = snapshot["event_type"]
    card_analysis = snapshot["card_analysis"]
    copy_variants = snapshot["copy_variants"]
    palette_data = snapshot["palette"]
    has_sub_events = bool(snapshot.get("has_sub_events", False))

    quiet_regions = card_analysis.get("quiet_regions") or []
    has_baked_text = bool(card_analysis.get("has_baked_text"))

    eligible_recipes_list = recipes.eligible_recipes(
        event_type=event_type,
        quiet_region_count=len(quiet_regions),
        has_baked_text=has_baked_text,
        has_sub_events=has_sub_events,
    )
    eligible_recipes_list = rank_eligible_recipes(eligible_recipes_list, card_analysis)
    eligible_presets_list = style_presets.eligible_presets(
        feeling=card_analysis.get("dominant_feeling"),
        is_dark_bg=palette_data.get("is_dark_bg", False),
    )

    # Apply locks AFTER eligibility so a lock can override eligibility filters
    # only when the locked id actually exists. If a lock points at something
    # that's not eligible (e.g. a recipe restricted to a different event_type),
    # we still honor the lock — staff explicitly asked for it.
    if lock_recipe_id:
        all_recipe_index = {r["id"]: r for r in recipes.all_recipes()}
        if lock_recipe_id not in all_recipe_index:
            raise ValueError(f"lock_recipe_id={lock_recipe_id!r} is not a known recipe.")
        eligible_recipes_list = [all_recipe_index[lock_recipe_id]]

    if lock_preset_id:
        all_preset_index = {p["id"]: p for p in style_presets.all_presets()}
        if lock_preset_id not in all_preset_index:
            raise ValueError(f"lock_preset_id={lock_preset_id!r} is not a known preset.")
        eligible_presets_list = [all_preset_index[lock_preset_id]]

    if lock_copy_idx is not None:
        try:
            lock_copy_idx = int(lock_copy_idx)
        except (TypeError, ValueError):
            raise ValueError("lock_copy_idx must be an integer.")
        if not (0 <= lock_copy_idx < len(copy_variants)):
            raise ValueError(
                f"lock_copy_idx={lock_copy_idx} out of range "
                f"(0..{len(copy_variants) - 1})."
            )
        copy_variants = [copy_variants[lock_copy_idx]]

    combos = sample_combinations(
        eligible_recipes_list=eligible_recipes_list,
        eligible_presets_list=eligible_presets_list,
        copy_variants=copy_variants,
        n_outputs=n_outputs,
        rng=rng,
    )

    drafts: list[dict] = []
    for draft_index, combo in enumerate(combos):
        copy = copy_variants[combo["copy_idx"] % len(copy_variants)]
        decoration_set = decorations.pick_decoration_set(
            preset=combo["preset"],
            feeling=card_analysis.get("dominant_feeling"),
            rng=rng,
        )
        effective_palette = palette.effective_palette_variation(
            palette_data, card_analysis, draft_index,
        )
        config, warnings = compose_config(
            card_url=card_url,
            card_analysis=card_analysis,
            palette_data=effective_palette,
            recipe=combo["recipe"],
            preset=combo["preset"],
            copy=copy,
            decoration_set=decoration_set,
            rng=rng,
        )
        tex = texture_variation.apply_texture_variation(
            config,
            draft_index=draft_index,
            card_analysis=card_analysis,
            copy=copy,
            seed=seed,
            request_id=request_id,
        )
        meta = {
            "recipe_id": combo["recipe"]["id"],
            "preset_id": combo["preset"]["id"],
            "tone": copy.get("tone"),
            "overlay_strategy": combo["recipe"]["overlay_strategy"],
            "card_feeling": card_analysis.get("dominant_feeling"),
            "card_style": card_analysis.get("visual_style"),
            "card_composition": card_analysis.get("composition"),
            "has_baked_text": has_baked_text,
            "fallback": bool(combo.get("fallback")),
            "warnings": warnings,
            "copy_notes": copy.get("notes", ""),
            "copy_headline": template_naming.copy_headline_snippet(copy.get("primary")),
            "decoration_set_id": (decoration_set or {}).get("id"),
            "remix": True,
            "parent_request_id": parent_request_id,
            "page_background_color": effective_palette.get("bg"),
            "locks": {
                "recipe_id": lock_recipe_id,
                "preset_id": lock_preset_id,
                "copy_idx": lock_copy_idx,
            },
            "structure_fingerprint": recipe_structure_fingerprint(combo["recipe"]),
            "texture_type": tex.get("type"),
            "texture_intensity": tex.get("intensity"),
        }
        drafts.append({"config": config, "meta": meta})

    # Re-store the snapshot under the new request_id so chained remixes work
    # (remix-of-a-remix). Same payload, fresh TTL.
    try:
        remix_cache.store(request_id=request_id, payload=snapshot)
    except Exception:
        logger.exception(
            "[remix_options] remix snapshot rewrite failed (non-fatal) for "
            "request_id=%s", request_id,
        )

    return {
        "drafts": drafts,
        "card_analysis_summary": {
            "composition": card_analysis.get("composition"),
            "visual_style": card_analysis.get("visual_style"),
            "dominant_feeling": card_analysis.get("dominant_feeling"),
            "has_baked_text": has_baked_text,
            "quiet_region_count": len(quiet_regions),
            "suggested_page_bg_palette": card_analysis.get(
                "suggested_page_bg_palette",
            ),
            "bg_lightness_preference": card_analysis.get(
                "bg_lightness_preference",
            ),
        },
        "palette": palette_data,
        "remix": True,
        "parent_request_id": parent_request_id,
    }
