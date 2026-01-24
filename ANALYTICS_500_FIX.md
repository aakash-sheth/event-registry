# Fix for Analytics 500 Internal Server Error

## Problem
The analytics endpoints are returning 500 errors because the database tables for `InvitePageView` and `RSVPPageView` don't exist yet.

## Solution

### 1. Run the Migration

The migration file has been created at:
```
backend/apps/events/migrations/0040_create_analytics_models.py
```

**In Docker:**
```bash
docker compose exec backend python manage.py migrate
```

**Or if running locally:**
```bash
cd backend
python manage.py migrate
```

### 2. Verify Migration Ran Successfully

After running the migration, you should see:
```
Running migrations:
  Applying events.0040_create_analytics_models... OK
```

### 3. Restart Services (if needed)

If you're running in Docker, restart the backend service:
```bash
docker compose restart backend
```

### 4. Test the Endpoints

After running migrations, the analytics endpoints should work:
- `GET /api/events/{id}/guests/analytics/`
- `GET /api/events/{id}/analytics/summary/`

## What Was Fixed

1. ✅ **Created Migration**: Added `0040_create_analytics_models.py` to create the database tables
2. ✅ **Added Error Handling**: Both analytics endpoints now have proper error handling with helpful error messages
3. ✅ **Better Error Messages**: If migrations haven't been run, you'll get a clear error message instead of a generic 500

## Troubleshooting

If you still get 500 errors after running migrations:

1. **Check backend logs:**
   ```bash
   docker compose logs backend | grep -i error
   ```

2. **Verify tables exist:**
   ```bash
   docker compose exec backend python manage.py shell
   ```
   Then in the shell:
   ```python
   from apps.events.models import InvitePageView, RSVPPageView
   print(InvitePageView.objects.count())  # Should not error
   print(RSVPPageView.objects.count())  # Should not error
   ```

3. **Check if background_task is enabled:**
   Make sure `background_task` is in `INSTALLED_APPS` in `settings.py` (it should be after our earlier fix)

4. **Verify the worker is running:**
   ```bash
   docker compose ps
   ```
   You should see `backend-worker` service running.

## Next Steps

After migrations are run:
1. The analytics endpoints will work
2. The analytics column will display data (once guests visit their invite/RSVP links)
3. The background worker will track page views when guests visit links
