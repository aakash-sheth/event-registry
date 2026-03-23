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
- `RSVP.will_attend` choices: 'yes', 'no', 'maybe'. `RSVP.guest` is nullable FK (SET_NULL).
- `Guest.phone` format: +CCXXXXXXXXXX
- `MessageCampaign`: bulk WhatsApp campaign. db_table='message_campaigns'. Added in 0052.
- `CampaignRecipient`: per-guest delivery row. db_table='campaign_recipients'. unique_together=[campaign, guest]. Added in 0052.

## Migration Sequence (events app)
- 0048_fix_analytics_models → 0049_analytics_indexes → 0050_add_registry_page_view → 0051_alter_analyticsbatchrun_options → 0052_add_message_campaigns

## Frontend API Pattern
- The frontend uses `NEXT_PUBLIC_API_BASE` (e.g. `http://localhost:8000`) as the full baseURL via axios — there is NO Next.js `/api/` proxy rewrite. API calls go directly to the Django backend.
- `RegistryViewTracker` uses the `api` axios instance (not raw `fetch`) to call `/api/events/registry/${slug}/view/`.

## URL Patterns
- `/api/events/registry/<slug>/view/` — POST, AllowAny, returns 204 (RecordRegistryView)
- `/api/events/invite/<slug>/` — GET, public invite page (cached)
- `/api/events/<event_id>/rsvp/guest-by-token/` — GET, resolves guest token for RSVP page
- `/api/events/<event_id>/campaigns/` — GET/POST list+create (MessageCampaignViewSet)
- `/api/events/<event_id>/campaigns/<id>/` — GET/PUT/PATCH/DELETE (ownership scoped)
- `/api/events/<event_id>/campaigns/<id>/launch/` — POST, queues dispatch_campaign background task
- `/api/events/<event_id>/campaigns/<id>/cancel/` — POST, transitions to CANCELLED
- `/api/events/<event_id>/campaigns/<id>/duplicate/` — POST, clones as PENDING
- `/api/events/<event_id>/campaigns/<id>/report/` — GET, paginated CampaignRecipient list (filterable by ?status=)
- `/api/events/<event_id>/campaigns/<id>/preview-recipients/` — GET, dry-run guest filter (max 20 preview)
- `/api/events/whatsapp/webhook/` — GET (Meta verification), POST (delivery status updates), AllowAny
- `/api/events/whatsapp/status/` — GET, IsAuthenticated, returns {enabled, configured}

## views.py Imports
- `from rest_framework.views import APIView` — added for RecordRegistryView
- `RegistryPageView` added to the models import line
- `ValidationError` added to `from rest_framework.exceptions import ...` (Phase 4)
- `from apps.common.whatsapp_backend import verify_webhook_signature` — added (Phase 4)
- `from .tasks import dispatch_campaign` — added (Phase 4)
- `MessageCampaign, CampaignRecipient` added to models import (Phase 4)
- `MessageCampaignSerializer, MessageCampaignCreateSerializer, CampaignRecipientSerializer` added to serializers import (Phase 4)

## Guest Token Flow
- Invite link: `?g=<token>` — used in PublicInviteViewSet
- RSVP page: `?token=<token>` or `?g=<token>` — used in get_guest_by_token
- Registry page: `?gt=<token>` — passed from FeatureButtonsTile href, tracked by RegistryViewTracker
- FeatureButtonsTile builds registry href as `/registry/${eventSlug}?gt=${guestToken}` when guestToken is present

## WhatsApp Campaign Architecture
- `apps/common/whatsapp_backend.py` — Meta Cloud API v19.0 wrapper. Key functions: `send_whatsapp_message()`, `replace_template_variables()`, `verify_webhook_signature()`.
- Meta expects phone numbers without leading '+' — strip it before API call.
- `WHATSAPP_APP_SECRET` used for HMAC-SHA256 webhook signature verification via `X-Hub-Signature-256` header.
- `WHATSAPP_SEND_DELAY_SECONDS` (default 0.2) used between sends for rate limiting.
- `django-background-tasks==1.2.8` is the task queue. Worker: `python manage.py process_tasks`.
- Campaign state machine: PENDING → SENDING → COMPLETED|FAILED. PENDING|SENDING → CANCELLED. Only PENDING can be edited/deleted.
- `NotificationLog` (apps/notifications/models.py): channel, to, template, payload_json, status (pending/sent/failed), last_error, created_at.
- `requests==2.31.0` added to requirements.txt (was missing; needed by whatsapp_backend.py).

## WhatsApp Campaign Frontend (Phase 5 — complete)
- Types/API in `frontend/lib/api.ts` (appended at end): `MessageCampaign`, `CampaignRecipient`, `WhatsAppStatusResponse`, `CampaignStatus`, `CampaignGuestFilter`, `CampaignMessageMode`, `RecipientStatus`.
- New components: `frontend/components/communications/WhatsAppSetupBanner.tsx`, `CampaignList.tsx`, `CampaignWizard.tsx`, `CampaignReport.tsx`.
- `useToast()` from `@/components/ui/toast` returns `{ showToast, toasts, removeToast }` — use `showToast(message, type)`. NOT `{ toast }` with object signature.
- `CampaignWizard` is a 3-step modal: Step 1 creates campaign via POST, Step 2 patches filter + calls preview-recipients, Step 3 launches.
- `CampaignList` polls every 10s when any campaign has `status === 'sending'`.
- Communications page (`frontend/app/host/events/[eventId]/communications/page.tsx`) has Templates | Campaigns tabs. Campaign components loaded with `dynamic(..., { ssr: false })`.
- `campaignListKey` state (integer incremented on wizard close) is used to remount `CampaignList` after create/update.

## Details: See patterns.md for serializer/view patterns
