"""
Tile-sequence recipes for the Page Layout Auto-Generator.

Each recipe is a static dict describing one composition: which tile types
appear, in what order, with which copy/overlay strategy. Recipes are
deterministic — they take no arguments and have no LLM cost.

Recipe selection is event-type-aware: a corporate event recipe should never
be chosen for a wedding card. The `fits` list cross-references
`Event.EVENT_TYPE_CHOICES` from `apps.events.models`.

Adding a new recipe? Make sure:
  - `id` is unique and kebab-case.
  - All `tile_sequence` entries are valid TileType values from the frontend
    schema (`frontend/lib/invite/schema.ts`).
  - `overlay_strategy` is one of the supported values below.
  - `fits` references real EVENT_TYPE_CHOICES keys (or 'all' as a wildcard).
"""
from __future__ import annotations

from copy import deepcopy
from typing import Iterable

# Valid overlay strategies — drives how the composer places copy.
#  none           — never overlay text on the card; copy lives in tiles below it.
#                   REQUIRED for cards with `has_baked_text=true`.
#  light_overlay  — single short title overlay on the card; subtitle goes below.
#  full_overlay   — title + subtitle stacked on top of the card.
#  banner_below   — title block lives in a small banner directly below the card.
#  separate_title — title is its own tile (no card overlay), card is just imagery.
OVERLAY_STRATEGIES = {
    "none",
    "light_overlay",
    "full_overlay",
    "banner_below",
    "separate_title",
}


# Convenience event-type buckets used in the `fits` field.
WEDDING_FAMILY = (
    "wedding", "engagement", "reception", "anniversary",
    "bridal_shower", "bachelor_party", "bachelorette_party",
)
LIFE_EVENTS = (
    "birthday", "baby_shower", "gender_reveal", "naming_ceremony",
    "housewarming", "graduation", "retirement",
)
RELIGIOUS = (
    "religious_ceremony", "puja", "satsang", "church_service",
    "bar_mitzvah", "bat_mitzvah", "communion", "confirmation",
)
PROFESSIONAL = (
    "corporate_event", "conference", "seminar", "workshop",
    "networking", "product_launch", "team_building", "award_ceremony",
)
SOCIAL = (
    "fundraiser", "charity_event", "community_event", "festival",
    "cultural_event", "exhibition", "art_show",
)
ENTERTAINMENT = (
    "concert", "music_event", "theater", "comedy_show", "sports_event",
)
DINING = (
    "dinner_party", "brunch", "cocktail_party", "tea_party", "potluck",
)


_RECIPES: list[dict] = [
    # -----------------------------------------------------------------
    # Overlay-on-card recipes (require non-empty quiet_regions)
    # -----------------------------------------------------------------
    {
        "id": "overlay-hero-classic",
        "tile_sequence": ["greeting-card", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "full_overlay",
        "fits": list(WEDDING_FAMILY) + list(RELIGIOUS),
        "weight": 1.0,
        "requires": {"min_quiet_regions": 1},
        "description": "Card with full title+date overlay, then details, then RSVP/Registry.",
    },
    {
        "id": "overlay-hero-with-timer",
        "tile_sequence": ["greeting-card", "timer", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "light_overlay",
        "fits": list(WEDDING_FAMILY) + list(LIFE_EVENTS),
        "weight": 1.0,
        "requires": {"min_quiet_regions": 1},
        "description": "Title overlaid lightly, with countdown timer above the details.",
    },
    {
        "id": "overlay-hero-with-description",
        "tile_sequence": ["greeting-card", "description", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "light_overlay",
        "fits": list(WEDDING_FAMILY) + list(SOCIAL) + list(LIFE_EVENTS),
        "weight": 0.9,
        "requires": {"min_quiet_regions": 1},
        "description": "Card-as-hero, then a short paragraph, then logistics.",
    },
    {
        "id": "overlay-hero-storyteller",
        "tile_sequence": ["greeting-card", "description", "timer", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "light_overlay",
        "fits": list(WEDDING_FAMILY) + list(LIFE_EVENTS),
        "weight": 0.7,
        "requires": {"min_quiet_regions": 1},
        "description": "Long-form: card + story + countdown + details.",
    },
    {
        "id": "overlay-hero-multi-event",
        "tile_sequence": ["greeting-card", "event-details", "event-carousel", "feature-buttons", "footer"],
        "overlay_strategy": "full_overlay",
        "fits": list(WEDDING_FAMILY) + list(RELIGIOUS),
        "weight": 0.6,
        "requires": {"min_quiet_regions": 1, "has_sub_events": True},
        "description": "Card hero + main details + all sub-events carousel.",
    },
    {
        "id": "image-overlay-classic",
        "tile_sequence": ["image", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "full_overlay",
        "fits": list(WEDDING_FAMILY) + list(RELIGIOUS),
        "weight": 0.85,
        "requires": {"min_quiet_regions": 1},
        "description": "Image hero with title+date overlays, then details and RSVP/Registry.",
    },
    {
        "id": "image-overlay-with-timer",
        "tile_sequence": ["image", "timer", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "light_overlay",
        "fits": list(WEDDING_FAMILY) + list(LIFE_EVENTS),
        "weight": 0.85,
        "requires": {"min_quiet_regions": 1},
        "description": "Image hero with light title overlay, countdown, then logistics.",
    },
    {
        "id": "image-overlay-with-story",
        "tile_sequence": ["image", "description", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "full_overlay",
        "fits": list(WEDDING_FAMILY) + list(SOCIAL) + list(LIFE_EVENTS),
        "weight": 0.6,
        "requires": {"min_quiet_regions": 1},
        "description": "Full-bleed image with overlays, story paragraph, then RSVP.",
    },
    # -----------------------------------------------------------------
    # No-overlay recipes (work for ALL cards, including baked-text ones)
    # -----------------------------------------------------------------
    {
        "id": "card-then-title",
        "tile_sequence": ["greeting-card", "title", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "none",
        "fits": ["all"],
        "weight": 1.2,  # safe everywhere, slight preference
        "requires": {},
        "description": "Card + separate title tile + details. Works even with baked-text cards.",
    },
    {
        "id": "image-then-title",
        "tile_sequence": ["image", "title", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "none",
        "fits": ["all"],
        "weight": 1.0,
        "requires": {},
        "description": "Image hero + separate title + details (distinct from greeting-card stack).",
    },
    {
        "id": "card-then-banner",
        "tile_sequence": ["greeting-card", "title", "timer", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "banner_below",
        "fits": ["all"],
        "weight": 1.0,
        "requires": {},
        "description": "Card with a title banner below + timer + logistics.",
    },
    {
        "id": "title-leads-card",
        "tile_sequence": ["title", "greeting-card", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": ["all"],
        "weight": 0.8,
        "requires": {},
        "description": "Editorial: oversize title first, card as visual punctuation, then details.",
    },
    {
        "id": "title-leads-image",
        "tile_sequence": ["title", "image", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": ["all"],
        "weight": 0.75,
        "requires": {},
        "description": "Title first, image hero, then logistics (image instead of greeting-card).",
    },
    {
        "id": "image-then-banner",
        "tile_sequence": ["image", "title", "timer", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "banner_below",
        "fits": ["all"],
        "weight": 0.85,
        "requires": {},
        "description": "Image hero with banner title below, countdown, then logistics.",
    },
    {
        "id": "story-first-card",
        "tile_sequence": ["description", "greeting-card", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "none",
        "fits": ["all"],
        "weight": 0.65,
        "requires": {},
        "description": "Short story or note leads, then card and details — invitation as narrative.",
    },
    {
        "id": "card-description-then-title",
        "tile_sequence": ["greeting-card", "description", "title", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "none",
        "fits": ["all"],
        "weight": 0.55,
        "requires": {},
        "description": "Hero card, paragraph, then headline tile — unusual vertical rhythm.",
    },
    {
        "id": "title-image-description-stack",
        "tile_sequence": ["title", "image", "description", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": list(WEDDING_FAMILY) + list(LIFE_EVENTS) + list(SOCIAL),
        "weight": 0.65,
        "requires": {},
        "description": "Editorial title, image, supporting copy, then logistics.",
    },
    {
        "id": "title-card-story-timer",
        "tile_sequence": ["title", "greeting-card", "description", "timer", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": list(WEDDING_FAMILY) + list(LIFE_EVENTS),
        "weight": 0.55,
        "requires": {},
        "description": "Title-led card with story block, countdown, then details.",
    },
    {
        "id": "title-card-description",
        "tile_sequence": ["title", "greeting-card", "description", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": list(WEDDING_FAMILY) + list(LIFE_EVENTS) + list(SOCIAL),
        "weight": 0.7,
        "requires": {},
        "description": "Magazine-feel: title, hero card, paragraph, logistics.",
    },
    {
        "id": "title-card-multi-event",
        "tile_sequence": ["title", "greeting-card", "event-details", "event-carousel", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": list(WEDDING_FAMILY) + list(RELIGIOUS) + list(SOCIAL),
        "weight": 0.5,
        "requires": {"has_sub_events": True},
        "description": "Title + card + main details + sub-events carousel.",
    },
    # -----------------------------------------------------------------
    # Professional / corporate recipes — sober, minimal
    # -----------------------------------------------------------------
    {
        "id": "corporate-formal",
        "tile_sequence": ["title", "greeting-card", "event-details", "description", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": list(PROFESSIONAL),
        "weight": 1.2,
        "requires": {},
        "description": "Title-led, single agenda paragraph, RSVP. Optimised for corporate.",
    },
    {
        "id": "corporate-agenda",
        "tile_sequence": ["title", "description", "event-details", "event-carousel", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": list(PROFESSIONAL),
        "weight": 0.8,
        "requires": {"has_sub_events": True},
        "description": "Agenda-style: title, summary, details, session carousel.",
    },
    {
        "id": "corporate-image-summary",
        "tile_sequence": ["title", "image", "event-details", "description", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": list(PROFESSIONAL),
        "weight": 0.75,
        "requires": {},
        "description": "Title, visual, logistics, then closing paragraph — brochure flow.",
    },
    # -----------------------------------------------------------------
    # Casual / dining / entertainment — playful sequencing
    # -----------------------------------------------------------------
    {
        "id": "playful-card-led",
        "tile_sequence": ["greeting-card", "title", "description", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "banner_below",
        "fits": list(LIFE_EVENTS) + list(DINING) + list(ENTERTAINMENT) + list(SOCIAL),
        "weight": 1.0,
        "requires": {},
        "description": "Card-led, friendly title banner, details below.",
    },
    {
        "id": "playful-overlay-fun",
        "tile_sequence": ["greeting-card", "timer", "event-details", "description", "feature-buttons", "footer"],
        "overlay_strategy": "full_overlay",
        "fits": list(LIFE_EVENTS) + list(DINING) + list(ENTERTAINMENT),
        "weight": 0.9,
        "requires": {"min_quiet_regions": 1},
        "description": "Title overlay, countdown, details, short note.",
    },
    {
        "id": "festival-bold",
        "tile_sequence": ["title", "greeting-card", "timer", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": list(SOCIAL) + list(ENTERTAINMENT) + list(LIFE_EVENTS),
        "weight": 0.8,
        "requires": {},
        "description": "Bold display title + card + countdown — festival mood.",
    },
    # -----------------------------------------------------------------
    # Religious / traditional — title-first, decorum
    # -----------------------------------------------------------------
    {
        "id": "religious-traditional",
        "tile_sequence": ["title", "description", "greeting-card", "event-details", "feature-buttons", "footer"],
        "overlay_strategy": "separate_title",
        "fits": list(RELIGIOUS),
        "weight": 1.1,
        "requires": {},
        "description": "Reverent: title, opening message or verse, card as imagery, then logistics.",
    },
]


def _matches_event_type(recipe: dict, event_type: str) -> bool:
    fits = recipe.get("fits") or []
    return "all" in fits or event_type in fits


def _matches_requirements(
    recipe: dict,
    *,
    quiet_region_count: int,
    has_sub_events: bool,
) -> bool:
    requires = recipe.get("requires") or {}
    min_quiet = int(requires.get("min_quiet_regions", 0))
    if quiet_region_count < min_quiet:
        return False
    if requires.get("has_sub_events") and not has_sub_events:
        return False
    overlay = recipe.get("overlay_strategy")
    if overlay in {"full_overlay", "light_overlay"} and quiet_region_count < 1:
        return False
    return True


def all_recipes() -> list[dict]:
    """Return a defensive deep-copy of the recipe catalogue."""
    return [deepcopy(r) for r in _RECIPES]


def eligible_recipes(
    *,
    event_type: str,
    quiet_region_count: int,
    has_baked_text: bool,
    has_sub_events: bool = False,
) -> list[dict]:
    """Filter recipes for the current generation context.

    A baked-text card collapses to ``no-overlay`` recipes only — the visual
    text is already there and adding more on top would clash. Recipes that
    need at least one quiet region are dropped if the card has none.
    """
    if has_baked_text:
        # Hard cap: only `none`/`banner_below`/`separate_title` strategies
        # whose `min_quiet_regions` is 0.
        candidates = [
            r for r in _RECIPES
            if r["overlay_strategy"] in {"none", "banner_below", "separate_title"}
        ]
    else:
        candidates = list(_RECIPES)

    out = [
        deepcopy(r)
        for r in candidates
        if _matches_event_type(r, event_type)
        and _matches_requirements(
            r,
            quiet_region_count=quiet_region_count,
            has_sub_events=has_sub_events,
        )
    ]

    # Always include at least the universal `card-then-title` so the
    # generator never returns nothing for a valid event_type.
    if not out:
        fallback = next(
            (deepcopy(r) for r in _RECIPES if r["id"] == "card-then-title"),
            None,
        )
        if fallback:
            out = [fallback]

    return out


def recipe_ids() -> Iterable[str]:
    return (r["id"] for r in _RECIPES)
