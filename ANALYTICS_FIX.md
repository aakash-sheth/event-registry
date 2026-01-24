# Analytics Column Fix

## Issues Fixed

### 1. **Analytics Column Not Updating**
**Problem:** The analytics column showed 0 views even when guests visited their invite links.

**Root Cause:** 
- Background tasks were disabled in Django settings (`background_task` was commented out)
- No background task worker process was running in Docker to process the queued tracking tasks

**Solution:**
- ✅ Enabled `background_task` in `backend/registry_backend/settings.py`
- ✅ Added `backend-worker` service to `docker-compose.yml` to process background tasks
- The worker runs `python manage.py process_tasks` to execute queued tracking tasks

### 2. **Analytics Column Not Clear**
**Problem:** The analytics column used emojis (📧 and ✅) which weren't clear about what information they displayed.

**Solution:**
- ✅ Replaced emojis with clear icons (eye icon for invite views, checkmark icon for RSVP views)
- ✅ Added descriptive labels ("Invite" and "RSVP") next to each metric
- ✅ Improved column header from "Analytics Invite / RSVP" to "Page Views" with subtitle "Invite • RSVP"
- ✅ Added helpful tooltips showing detailed information on hover
- ✅ Better visual hierarchy with proper spacing and colors

## What You Need to Do

### 1. Restart Docker Services
After pulling these changes, restart your Docker services to start the background worker:

```bash
docker compose down
docker compose up -d
```

### 2. Run Migrations (if needed)
If you haven't run migrations for the analytics models yet:

```bash
docker compose exec backend python manage.py migrate
```

### 3. Verify Worker is Running
Check that the background worker is running:

```bash
docker compose ps
```

You should see both `backend` and `backend-worker` services running.

### 4. Test the Analytics
1. Visit a guest's invite link (using the "Copy Link" button)
2. Visit the RSVP page for that guest
3. Go back to the guests page and refresh
4. The analytics column should now show updated view counts

## How It Works

1. **When a guest visits their invite link:**
   - The backend calls `track_invite_page_view()` which queues a background task
   - The background worker processes this task and creates an `InvitePageView` record

2. **When a guest visits the RSVP page:**
   - The backend calls `track_rsvp_page_view()` which queues a background task
   - The background worker processes this task and creates an `RSVPPageView` record

3. **When you view the guests page:**
   - The frontend calls `/api/events/{id}/guests/analytics/`
   - The backend aggregates all view records and returns counts and last view dates
   - The analytics column displays this information with clear labels and icons

## Column Display

The analytics column now shows:
- **Invite Views:** Eye icon + count + last viewed date (if any)
- **RSVP Views:** Checkmark icon + count + last viewed date (if any)
- **Tooltips:** Hover over any row to see detailed information including full timestamps

## Troubleshooting

If analytics still aren't updating:

1. **Check worker logs:**
   ```bash
   docker compose logs backend-worker
   ```

2. **Check if tasks are being queued:**
   ```bash
   docker compose exec backend python manage.py shell
   ```
   Then in the shell:
   ```python
   from background_task.models import Task
   print(Task.objects.count())  # Should show queued tasks
   ```

3. **Manually process tasks (for testing):**
   ```bash
   docker compose exec backend python manage.py process_tasks
   ```

4. **Check backend logs for tracking errors:**
   ```bash
   docker compose logs backend | grep -i tracking
   ```
