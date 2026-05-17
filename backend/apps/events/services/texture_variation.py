"""
Post-compose page texture diversification for the layout auto-generator.

Mirrors ``TextureType`` in ``frontend/lib/invite/schema.ts``. After
``compose_config`` copies texture from the style preset, we replace it with
a deterministic pick from a feeling/tone-aware pool so drafts differ visibly.
"""
from __future__ import annotations

import random
import zlib
from copy import deepcopy
from typing import Any, Optional

# Keep in sync with frontend ``TextureType``.
ALLOWED_TEXTURE_TYPES: frozenset[str] = frozenset(
    {
        "none",
        "paper-grain",
        "linen",
        "canvas",
        "parchment",
        "vintage-paper",
        "silk",
        "marble",
    }
)

_FULL_ORDER: tuple[str, ...] = (
    "linen",
    "paper-grain",
    "canvas",
    "parchment",
    "vintage-paper",
    "silk",
    "marble",
    "none",
)

# Subsets keyed by vision ``dominant_feeling`` / card analyzer enum.
_FEELING_TEXTURES: dict[str, frozenset[str]] = {
    "romantic": frozenset({"linen", "vintage-paper", "silk", "parchment", "paper-grain", "marble"}),
    "warm": frozenset({"linen", "parchment", "canvas", "vintage-paper", "paper-grain"}),
    "intimate": frozenset({"linen", "silk", "vintage-paper", "parchment"}),
    "elegant": frozenset({"linen", "silk", "marble", "vintage-paper", "paper-grain"}),
    "modern": frozenset({"marble", "none", "silk", "linen", "paper-grain"}),
    "serene": frozenset({"marble", "none", "silk", "vintage-paper", "linen"}),
    "rustic": frozenset({"parchment", "vintage-paper", "canvas", "paper-grain"}),
    "traditional": frozenset({"parchment", "silk", "paper-grain", "linen", "vintage-paper"}),
    "playful": frozenset({"canvas", "paper-grain", "linen", "marble"}),
    "celebratory": frozenset({"canvas", "linen", "silk", "marble", "paper-grain"}),
}

# Subsets keyed by copy ``tone`` from ``copy_generator``.
_TONE_TEXTURES: dict[str, frozenset[str]] = {
    "modern": frozenset({"marble", "none", "silk", "linen"}),
    "rustic": frozenset({"parchment", "canvas", "vintage-paper", "paper-grain"}),
    "playful": frozenset({"canvas", "paper-grain", "linen"}),
    "elegant": frozenset({"linen", "silk", "marble", "vintage-paper"}),
    "warm": frozenset({"linen", "parchment", "canvas", "vintage-paper"}),
    "traditional": frozenset({"parchment", "silk", "paper-grain", "linen"}),
    "celebratory": frozenset({"canvas", "linen", "silk", "marble"}),
    "intimate": frozenset({"linen", "silk", "vintage-paper", "parchment"}),
}

_INTENSITY_TIERS: tuple[int, ...] = (28, 52, 72)


def _stable_key_from_request_id(request_id: str) -> int:
    return zlib.crc32(request_id.encode("utf-8")) & 0xFFFFFFFF


def texture_pool(dominant_feeling: Optional[str], copy_tone: Optional[str]) -> list[str]:
    """Union of texture types allowed for this feeling and copy tone; stable order base."""
    f = (dominant_feeling or "").lower().strip()
    t = (copy_tone or "").lower().strip()
    buckets: list[frozenset[str]] = []
    if f in _FEELING_TEXTURES:
        buckets.append(_FEELING_TEXTURES[f])
    if t in _TONE_TEXTURES:
        buckets.append(_TONE_TEXTURES[t])
    if not buckets:
        return list(_FULL_ORDER)
    combined: set[str] = set()
    for b in buckets:
        combined |= b
    combined &= ALLOWED_TEXTURE_TYPES
    if len(combined) < 3:
        combined |= set(_FULL_ORDER)
        combined &= ALLOWED_TEXTURE_TYPES
    return [x for x in _FULL_ORDER if x in combined]


def _shuffled_pool(pool: list[str], key: int) -> list[str]:
    p = list(pool)
    random.Random(key).shuffle(p)
    return p


def intensity_for_texture(texture_type: str, draft_index: int) -> int:
    if texture_type == "none":
        return 0
    return _INTENSITY_TIERS[draft_index % len(_INTENSITY_TIERS)]


def apply_texture_variation(
    config: dict[str, Any],
    *,
    draft_index: int,
    card_analysis: dict[str, Any],
    copy: dict[str, Any],
    seed: Optional[int],
    request_id: str,
) -> dict[str, Any]:
    """Set ``config['texture']`` to a diversified texture; returns the texture dict for meta."""
    feeling = card_analysis.get("dominant_feeling")
    tone = copy.get("tone")
    pool = texture_pool(
        str(feeling) if feeling is not None else None,
        str(tone) if tone is not None else None,
    )
    key = (seed if seed is not None else _stable_key_from_request_id(request_id)) & 0xFFFFFFFF
    order = _shuffled_pool(pool, key)
    selected = order[draft_index % len(order)]
    intensity = intensity_for_texture(selected, draft_index)
    out: dict[str, Any] = {"type": selected, "intensity": intensity}
    config["texture"] = deepcopy(out)
    return out
