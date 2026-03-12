# EkFern Agent Memory

## Analytics Architecture (post 2026-03 direct-write migration)
- **No batch pipeline**: tasks.py is now empty (just a docstring). collect_page_view(), process_analytics_batch(), and all helpers were removed.
- **Invite views**: Written directly in PublicInviteViewSet via `InvitePageView.objects.create()` when `guest is not None and not is_preview`.
- **RSVP views**: Written directly in `get_guest_by_token` view via `RSVPPageView.objects.create()`.
- **Registry views**: Written via `RecordRegistryView` (POST `/api/events/registry/<slug>/view/?gt=<token>`), called from `RegistryViewTracker` frontend component.
- **EventBridge rule** `analytics-batch-processor` is disabled; do not re-enable without restoring batch pipeline.
- **docker-compose backend-worker**: now runs `python manage.py process_tasks` only (no schedule_analytics_batch).

## Key Model Details (confirmed)
- `InvitePageView`: has `source_channel`, `attribution_link`, `campaign`, `placement`, `viewed_at` fields.
- `RSVPPageView`: has same fields as InvitePageView (source_channel, attribution_link, campaign, placement, viewed_at).
- `RegistryPageView`: simpler — only `guest`, `event`, `viewed_at`. Added in migration 0050.
- All three have `UniqueConstraint` on (guest, event, viewed_at).

## Migration Sequence (events app)
- 0048_fix_analytics_models → 0049_analytics_indexes → 0050_add_registry_page_view

## Frontend API Pattern
- The frontend uses `NEXT_PUBLIC_API_BASE` (e.g. `http://localhost:8000`) as the full baseURL via axios — there is NO Next.js `/api/` proxy rewrite. API calls go directly to the Django backend.
- `RegistryViewTracker` uses the `api` axios instance (not raw `fetch`) to call `/api/events/registry/${slug}/view/`.

## URL Patterns
- `/api/events/registry/<slug>/view/` — POST, AllowAny, returns 204 (RecordRegistryView)
- `/api/events/invite/<slug>/` — GET, public invite page (cached)
- `/api/events/<event_id>/rsvp/guest-by-token/` — GET, resolves guest token for RSVP page

## views.py Imports
- `from rest_framework.views import APIView` — added for RecordRegistryView
- `RegistryPageView` added to the models import line

## Guest Token Flow
- Invite link: `?g=<token>` — used in PublicInviteViewSet
- RSVP page: `?token=<token>` or `?g=<token>` — used in get_guest_by_token
- Registry page: `?gt=<token>` — passed from FeatureButtonsTile href, tracked by RegistryViewTracker
- FeatureButtonsTile builds registry href as `/registry/${eventSlug}?gt=${guestToken}` when guestToken is present

## Details: See patterns.md for serializer/view patterns
