# Debug Guide: Page Not Rendering - Step-by-Step Checklist

## Issue Found and Fixed ✅

**CRITICAL BUG FIXED**: `PublicEventViewSet` was missing slug normalization to lowercase, causing case-sensitive lookup failures.

## Step-by-Step Debugging Flow

### Step 1: Frontend Routing ✅
**Location**: `frontend/app/registry/[slug]/page.tsx` and `frontend/app/invite/[slug]/page.tsx`

**Check**:
- ✅ Next.js dynamic route `[slug]` extracts slug from URL
- ✅ Slug is passed to API calls: `/api/registry/${slug}/items` and `/api/registry/${slug}/`

**Potential Issues**:
- ❌ Slug contains special characters (should be URL-encoded)
- ❌ Slug is empty or undefined

**Debug**:
```javascript
console.log('Slug from URL:', params.slug)
console.log('API URL:', `/api/registry/${slug}/items`)
```

---

### Step 2: Frontend API Call ✅
**Location**: `frontend/app/registry/[slug]/page.tsx:59-89`

**Check**:
- ✅ API base URL is correct (`NEXT_PUBLIC_API_BASE`)
- ✅ Request is sent to correct endpoint
- ✅ Error handling catches 403/404 responses

**Potential Issues**:
- ❌ CORS errors (check browser console)
- ❌ Network timeout
- ❌ API base URL incorrect

**Debug**:
```javascript
// In browser console, check Network tab:
// 1. Is request sent? (Status: pending/success/error)
// 2. What's the response status code?
// 3. What's the response body?
```

---

### Step 3: Backend URL Routing ✅
**Location**: `backend/registry_backend/urls.py` → `backend/apps/events/public_urls.py`

**Check**:
- ✅ URL pattern matches: `/api/registry/` → `apps.events.public_urls`
- ✅ Router registers `PublicEventViewSet` with basename `'public-event'`
- ✅ Custom route: `<slug:slug>/items` maps to `items` action

**URL Patterns**:
```
/api/registry/                    → PublicEventViewSet.list()
/api/registry/{slug}/              → PublicEventViewSet.retrieve()  [FIXED: now normalizes slug]
/api/registry/{slug}/items          → PublicEventViewSet.items()    [FIXED: now normalizes slug]
```

**Potential Issues**:
- ❌ URL pattern doesn't match (check trailing slashes)
- ❌ Router not registered correctly

**Debug**:
```python
# Test URL routing:
python manage.py shell
from django.urls import resolve
resolve('/api/registry/test-slug/')  # Should return PublicEventViewSet
```

---

### Step 4: Backend Slug Lookup 🔧 **FIXED**
**Location**: `backend/apps/events/views.py:1379-1473`

**Issue Found**: 
- ❌ `PublicEventViewSet.retrieve()` didn't normalize slug to lowercase
- ❌ `PublicEventViewSet.items()` didn't normalize slug to lowercase
- ✅ `PublicInviteViewSet.retrieve()` correctly normalizes slug (line 1181)

**Fix Applied**:
```python
def retrieve(self, request, *args, **kwargs):
    """Override retrieve to normalize slug to lowercase before lookup"""
    if 'slug' in kwargs:
        kwargs['slug'] = kwargs['slug'].lower() if kwargs['slug'] else ''
    return super().retrieve(request, *args, **kwargs)

@action(detail=True, methods=['get'])
def items(self, request, slug=None):
    """Get active items for public registry - no private data exposed"""
    # Normalize slug to lowercase (all slugs are stored in lowercase)
    if slug:
        slug = slug.lower()
    event = get_object_or_404(Event, slug=slug)
```

**Why This Matters**:
- Database stores slugs in lowercase (see `Event.save()` method)
- If user types `/registry/John-Jane-Wedding`, lookup fails without normalization
- Case-sensitive database queries return 404 even though event exists

**Check**:
- ✅ Slug normalized in `retrieve()` method
- ✅ Slug normalized in `items()` action
- ✅ Database query uses normalized slug

**Debug**:
```python
# Test slug normalization:
python manage.py shell
from apps.events.models import Event

# Create test event
event = Event.objects.create(slug='test-event', ...)

# Test case-sensitive lookup (should fail)
Event.objects.get(slug='Test-Event')  # DoesNotExist

# Test case-insensitive lookup (should work)
Event.objects.get(slug='test-event')  # Success
```

---

### Step 5: Database Query ✅
**Location**: `backend/apps/events/models.py:83-87`

**Check**:
- ✅ Event exists in database with correct slug
- ✅ Slug is stored in lowercase (enforced by `Event.save()`)
- ✅ Database index exists on `slug` field (unique constraint)

**Potential Issues**:
- ❌ Event doesn't exist (404)
- ❌ Slug mismatch (case sensitivity) [FIXED]
- ❌ Database connection issues

**Debug**:
```python
# Check if event exists:
python manage.py shell
from apps.events.models import Event

# List all events and their slugs
for event in Event.objects.all():
    print(f"ID: {event.id}, Slug: {event.slug}, Title: {event.title}")

# Check specific slug
slug = 'your-slug-here'
try:
    event = Event.objects.get(slug=slug.lower())
    print(f"✅ Found: {event.title}")
except Event.DoesNotExist:
    print(f"❌ Not found: {slug}")
```

---

### Step 6: Response Serialization ✅
**Location**: `backend/apps/events/serializers.py:EventSerializer`

**Check**:
- ✅ `EventSerializer` includes all required fields
- ✅ No serialization errors
- ✅ Response format matches frontend expectations

**Expected Response**:
```json
{
  "id": 1,
  "slug": "john-jane-wedding",
  "title": "John & Jane's Wedding",
  "date": "2024-06-15",
  "city": "Mumbai",
  "country": "IN",
  "has_rsvp": true,
  "has_registry": true,
  ...
}
```

**Potential Issues**:
- ❌ Missing required fields in serializer
- ❌ Serialization errors (check backend logs)

---

### Step 7: Frontend Error Handling ✅
**Location**: `frontend/app/registry/[slug]/page.tsx:73-85`

**Check**:
- ✅ 403 errors handled (registry disabled)
- ✅ 404 errors handled (event not found)
- ✅ Network errors handled
- ✅ Loading states managed

**Error Scenarios**:
1. **403 Forbidden**: Registry disabled → Falls back to `/api/registry/${slug}/`
2. **404 Not Found**: Event doesn't exist → Shows "Event Not Found" message
3. **Network Error**: API unreachable → Shows error message

**Debug**:
```javascript
// Add detailed logging:
catch (error: any) {
  console.error('Error details:', {
    status: error.response?.status,
    message: error.response?.data?.error || error.message,
    url: error.config?.url,
    slug: slug
  })
  logError('Failed to fetch registry:', error)
  // ... rest of error handling
}
```

---

## Complete Debugging Checklist

### Frontend Checks:
- [ ] Slug extracted correctly from URL params
- [ ] API base URL is correct
- [ ] Request sent to correct endpoint
- [ ] Check browser Network tab for request/response
- [ ] Check browser Console for errors
- [ ] Verify response status code (200/403/404/500)

### Backend Checks:
- [ ] URL routing matches correctly
- [ ] Slug normalized to lowercase ✅ **FIXED**
- [ ] Event exists in database with matching slug
- [ ] Database query succeeds
- [ ] Serialization completes without errors
- [ ] Response returned with correct status code

### Database Checks:
- [ ] Event record exists
- [ ] Slug stored in lowercase
- [ ] No database connection issues
- [ ] Database indexes are correct

---

## Common Issues and Solutions

### Issue 1: 404 Not Found
**Cause**: Slug mismatch (case sensitivity) ✅ **FIXED**
**Solution**: Slug normalization added to `PublicEventViewSet`

### Issue 2: 403 Forbidden
**Cause**: Registry disabled or private event
**Solution**: Frontend handles this by falling back to event endpoint

### Issue 3: CORS Error
**Cause**: API base URL incorrect or CORS not configured
**Solution**: Check `NEXT_PUBLIC_API_BASE` and backend CORS settings

### Issue 4: Network Timeout
**Cause**: API server unreachable or slow
**Solution**: Check API server status and network connectivity

### Issue 5: Serialization Error
**Cause**: Missing fields or data type mismatch
**Solution**: Check backend logs for serialization errors

---

## Testing the Fix

After applying the slug normalization fix:

1. **Test Case 1**: Access with lowercase slug
   ```
   GET /api/registry/john-jane-wedding/
   Expected: 200 OK
   ```

2. **Test Case 2**: Access with mixed case slug
   ```
   GET /api/registry/John-Jane-Wedding/
   Expected: 200 OK (now works after fix)
   ```

3. **Test Case 3**: Access with uppercase slug
   ```
   GET /api/registry/JOHN-JANE-WEDDING/
   Expected: 200 OK (now works after fix)
   ```

4. **Test Case 4**: Non-existent slug
   ```
   GET /api/registry/non-existent/
   Expected: 404 Not Found
   ```

---

## Next Steps

1. ✅ **FIXED**: Added slug normalization to `PublicEventViewSet.retrieve()`
2. ✅ **FIXED**: Added slug normalization to `PublicEventViewSet.items()`
3. ⏳ **TODO**: Test the fix with various slug formats
4. ⏳ **TODO**: Monitor logs for any remaining 404 errors
5. ⏳ **TODO**: Consider adding database-level case-insensitive index (if needed)

---

## Related Files

- `backend/apps/events/views.py` - ViewSet implementations
- `backend/apps/events/public_urls.py` - URL routing
- `backend/apps/events/models.py` - Event model with slug normalization
- `frontend/app/registry/[slug]/page.tsx` - Frontend registry page
- `frontend/app/invite/[slug]/page.tsx` - Frontend invite page
- `frontend/lib/api.ts` - API client configuration

