# Privacy & Security Model

## Core Privacy Principles

1. **Host Isolation**: Each host can ONLY access their own events, guest lists, RSVPs, orders, and items.
2. **No Cross-Host Access**: Hosts cannot see, modify, or access any data belonging to other hosts.
3. **Guest List Privacy**: Guest lists are completely private to the host who created them.
4. **Public vs Private**: Public events only expose basic event info and active registry items. No guest lists, RSVPs, or order details are exposed.

## Security Implementation

### EventViewSet
- `get_queryset()`: Filters events by `host=self.request.user`
- `get_object()`: Double-checks ownership before returning event
- `_verify_event_ownership()`: Helper method that raises PermissionDenied if not owner
- All actions (guests, rsvps, orders, etc.) verify ownership before processing

### RegistryItemViewSet
- `get_queryset()`: Only returns items for events owned by current user
- `get_object()`: Verifies item ownership through event
- `perform_create()`: Verifies event ownership before creating item

### Order Views
- `get_order()`: Verifies order belongs to event owned by current user
- `create_order()`: Public endpoint (for guests), but orders are linked to events

### Guest List
- All guest operations verify event ownership
- Guests are scoped to events: `Guest.objects.filter(event=event)`
- RSVPs can link to guests, but only the event host can see this relationship

### RSVP
- Public endpoint for creating RSVPs (guests need to RSVP)
- Host-only endpoint for viewing RSVPs: `/api/events/{id}/rsvps/`
- RSVPs are scoped to events: `RSVP.objects.filter(event=event)`

## Data Isolation

All queries use explicit filtering:
- Events: `Event.objects.filter(host=user)`
- Guests: `Guest.objects.filter(event=event)` (event already verified as owned by user)
- RSVPs: `RSVP.objects.filter(event=event)` (event already verified as owned by user)
- Orders: `Order.objects.filter(event=event)` (event already verified as owned by user)
- Items: `RegistryItem.objects.filter(event=event)` (event already verified as owned by user)

## Public Endpoints

Public endpoints (no authentication) only expose:
- Event basic info (title, date, city, slug) - if `is_public=True`
- Active registry items - if `is_public=True`
- RSVP creation - guests can RSVP to public events

Public endpoints NEVER expose:
- Guest lists
- Host information (beyond what's in EventSerializer)
- Order details
- RSVP details (except when creating one)
- Private events

