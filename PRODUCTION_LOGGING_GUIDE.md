# Production Logging Guide - Page Rendering Debug

## Overview

Comprehensive console logging has been added to help debug page rendering issues in production. Logs are visible in:

- **Frontend**: Browser Console (F12 → Console tab)
- **Backend**: CloudWatch Logs (via ECS/Django logging)

---

## Frontend Logging

### Registry Page (`/registry/[slug]`)

**Location**: `frontend/app/registry/[slug]/page.tsx`

**Logs Added**:

1. **Component Mount/Update**
   ```
   [RegistryPage] Component mounted/updated with slug: {slug}
   ```

2. **API Request Start**
   ```
   [RegistryPage] Starting fetchRegistry for slug: {slug}
   [RegistryPage] API URL: /api/registry/{slug}/items
   [RegistryPage] Making API request to: /api/registry/{slug}/items
   ```

3. **API Response Success**
   ```
   [RegistryPage] API response received: {
     status: 200,
     hasEvent: true,
     hasItems: true,
     itemsCount: 5,
     eventSlug: "john-jane-wedding",
     eventTitle: "John & Jane's Wedding",
     hasRegistry: true
   }
   ```

4. **Registry Status**
   ```
   [RegistryPage] Registry is disabled for this event
   // OR
   [RegistryPage] Registry enabled, setting items: 5
   ```

5. **Error Handling**
   ```
   [RegistryPage] Error fetching registry: {
     slug: "john-jane-wedding",
     apiUrl: "/api/registry/john-jane-wedding/items",
     status: 404,
     statusText: "Not Found",
     errorMessage: "...",
     errorDetails: {...}
   }
   ```

6. **Fallback Logic**
   ```
   [RegistryPage] Got 403, attempting fallback to event endpoint
   [RegistryPage] Fetching event data from: /api/registry/{slug}/
   [RegistryPage] Fallback event data received: {...}
   ```

7. **404 Errors**
   ```
   [RegistryPage] 404 - Event not found for slug: {slug}
   ```

8. **Completion**
   ```
   [RegistryPage] fetchRegistry completed, setting loading to false
   ```

---

### Invite Page (`/invite/[slug]`)

**Location**: `frontend/app/invite/[slug]/page.tsx`

**Logs Added**:

1. **fetchInviteData Start**
   ```
   [InvitePage SSR] fetchInviteData starting: {
     slug: "john-jane-wedding",
     apiBase: "https://api.example.com",
     url: "https://api.example.com/api/events/invite/john-jane-wedding/",
     guestToken: "present" | "none",
     retries: 1
   }
   ```

2. **Request Attempts**
   ```
   [InvitePage SSR] fetchInviteData attempt 1/2 for slug: {slug}
   ```

3. **Success Response**
   ```
   [InvitePage SSR] Successfully fetched invite data for {slug}: {
     status: 200,
     hasConfig: true,
     hasEvent: true,
     eventId: 123,
     keys: ["config", "event", "allowed_sub_events", ...]
   }
   ```

4. **fetchEventData (Fallback)**
   ```
   [InvitePage SSR] fetchEventData starting: {
     slug: "john-jane-wedding",
     apiBase: "https://api.example.com",
     url: "https://api.example.com/api/registry/john-jane-wedding/",
     retries: 1
   }
   ```

5. **Event Data Success**
   ```
   [InvitePage SSR] Successfully fetched event data for {slug}: {
     status: 200,
     eventId: 123,
     eventSlug: "john-jane-wedding",
     eventTitle: "John & Jane's Wedding",
     hasRegistry: true,
     hasRsvp: true
   }
   ```

6. **Error Logging** (already existed, enhanced)
   - Client errors (4xx)
   - Server errors (5xx)
   - Network errors
   - Timeout errors

---

## Backend Logging

### PublicEventViewSet

**Location**: `backend/apps/events/views.py:1379-1483`

**Logs Added**:

1. **retrieve() Method**
   ```
   [PublicEventViewSet.retrieve] Request received - Original slug: 'John-Jane-Wedding'
   [PublicEventViewSet.retrieve] Slug normalized: 'John-Jane-Wedding' -> 'john-jane-wedding'
   [PublicEventViewSet.retrieve] Success - Slug: 'john-jane-wedding', Status: 200
   ```

2. **items() Method**
   ```
   [PublicEventViewSet.items] Request received - Original slug: 'John-Jane-Wedding'
   [PublicEventViewSet.items] Slug normalized: 'John-Jane-Wedding' -> 'john-jane-wedding'
   [PublicEventViewSet.items] Querying database for slug: 'john-jane-wedding'
   [PublicEventViewSet.items] Event found - ID: 123, Title: 'John & Jane's Wedding', Slug: 'john-jane-wedding', HasRegistry: True, IsPublic: True
   [PublicEventViewSet.items] Fetching active items for event ID: 123
   [PublicEventViewSet.items] Found 5 active items
   [PublicEventViewSet.items] Success - Event ID: 123, Items returned: 5
   ```

3. **Error Cases**
   ```
   [PublicEventViewSet.items] Registry disabled for event ID: 123, Slug: 'john-jane-wedding'
   [PublicEventViewSet.items] Database query failed - Slug: 'john-jane-wedding', Error: ...
   [PublicEventViewSet.retrieve] Error - Slug: 'john-jane-wedding', Error: ...
   ```

---

### PublicInviteViewSet

**Location**: `backend/apps/events/views.py:1146-1256`

**Logs Added** (Enhanced existing logging):

1. **Slug Normalization**
   ```
   [PublicInviteViewSet.retrieve] Request received - Slug: 'john-jane-wedding'
   [PublicInviteViewSet.retrieve] Slug normalized: 'John-Jane-Wedding' -> 'john-jane-wedding'
   ```

2. **Step-by-Step Lookup**
   ```
   [PublicInviteViewSet.retrieve] Step 1: Looking for published invite page with slug: 'john-jane-wedding'
   [PublicInviteViewSet.retrieve] Step 1 SUCCESS - Found published invite page (ID: 456, Event ID: 123, Query time: 0.023s)
   
   // OR if Step 1 fails:
   [PublicInviteViewSet.retrieve] Step 1 FAILED: Published invite page not found (Query time: 0.015s)
   [PublicInviteViewSet.retrieve] Step 2: Looking for unpublished invite page with slug: 'john-jane-wedding'
   [PublicInviteViewSet.retrieve] Step 2: Found invite page (ID: 456, Published: False, Query time: 0.012s)
   [PublicInviteViewSet.retrieve] Step 2 SUCCESS - Using published invite page
   
   // OR if Step 2 fails:
   [PublicInviteViewSet.retrieve] Step 2 FAILED: InvitePage not found (Query time: 0.010s)
   [PublicInviteViewSet.retrieve] Step 3: Looking for event with slug: 'john-jane-wedding'
   [PublicInviteViewSet.retrieve] Step 3: Event found (ID: 123, Title: 'John & Jane's Wedding') but no invite page (Query time: 0.008s)
   ```

3. **404 Errors**
   ```
   [PublicInviteViewSet.retrieve] Step 3: Event not found for slug: 'non-existent' (Query time: 0.005s)
   INVITE_404: Invite page or event not found
   ```

---

## How to Use These Logs

### Frontend Debugging (Browser Console)

1. **Open Browser Console**
   - Chrome/Edge: F12 → Console tab
   - Firefox: F12 → Console tab
   - Safari: Cmd+Option+C

2. **Filter Logs**
   - Type `[RegistryPage]` or `[InvitePage SSR]` in console filter
   - This shows only relevant logs

3. **Check Flow**
   - Look for log sequence:
     - Component mount → API request → Response → Success/Error
   - If missing a step, that's where the issue is

### Backend Debugging (CloudWatch)

1. **Access CloudWatch Logs**
   - AWS Console → CloudWatch → Log Groups
   - Find your ECS task log group (e.g., `/ecs/backend-task`)

2. **Filter Logs**
   - Search for: `[PublicEventViewSet]` or `[PublicInviteViewSet]`
   - Filter by time range when issue occurred

3. **Check Flow**
   - Look for:
     - Request received → Slug normalization → Database query → Success/Error
   - Query times help identify slow queries

---

## Common Issues to Look For

### Issue 1: Slug Case Mismatch
**Symptoms**: 404 errors even though event exists
**Logs to Check**:
```
[PublicEventViewSet.retrieve] Slug normalized: 'John-Jane-Wedding' -> 'john-jane-wedding'
```
If normalization is missing, that's the issue.

### Issue 2: Database Query Fails
**Symptoms**: 404 or 500 errors
**Logs to Check**:
```
[PublicEventViewSet.items] Database query failed - Slug: '...', Error: ...
```
Check the error message for details.

### Issue 3: Registry Disabled
**Symptoms**: 403 errors
**Logs to Check**:
```
[PublicEventViewSet.items] Registry disabled for event ID: 123
[RegistryPage] Got 403, attempting fallback to event endpoint
```
This is expected behavior - frontend should handle fallback.

### Issue 4: Network Timeout
**Symptoms**: No response, loading forever
**Logs to Check**:
```
[InvitePage SSR] Timeout fetching invite data for {slug} after 2 attempts
```
Check API server status and network connectivity.

### Issue 5: Missing Invite Page
**Symptoms**: 404 on `/invite/[slug]` but event exists
**Logs to Check**:
```
[PublicInviteViewSet.retrieve] Step 3: Event found (ID: 123) but no invite page
```
Invite page needs to be created/published.

---

## Log Levels

- **INFO**: Normal flow, successful operations
- **WARNING**: Non-critical issues (e.g., fallback used)
- **ERROR**: Critical failures (404, 500, exceptions)

---

## Performance Monitoring

Query times are logged to identify slow queries:
```
Query time: 0.023s
```

If query times are consistently > 1s, consider:
- Database indexing
- Query optimization
- Caching

---

## Removing Logs (After Debugging)

Once the issue is resolved, you can:

1. **Keep logs but reduce verbosity**: Change `console.log` to `console.debug` (won't show in production by default)
2. **Remove logs**: Delete the console.log statements
3. **Conditional logging**: Wrap in `if (process.env.NODE_ENV === 'development')`

For backend, logs are already using proper logging levels, so they can stay for production monitoring.

---

## Next Steps

1. Deploy these changes to production
2. Monitor logs when issue occurs
3. Use logs to identify exact failure point
4. Fix the root cause
5. Optionally reduce log verbosity after resolution

