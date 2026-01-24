# Backend Startup Fix

## Issue
The backend server is crashing with `ERR_CONNECTION_RESET` because `django-background-tasks` requires database tables that don't exist yet.

## Quick Fix (Temporary)

I've temporarily commented out `background_task` from `INSTALLED_APPS` so the backend can start. The tracking code will gracefully skip tracking until migrations are run.

## Steps to Enable Full Functionality

### 1. Run Migrations
```bash
cd backend
source venv/bin/activate  # or activate your virtual environment
python manage.py makemigrations events
python manage.py migrate
```

This will create:
- `invite_page_views` table
- `rsvp_page_views` table
- `background_task` tables (when you enable it)

### 2. Re-enable Background Tasks
After migrations are run, uncomment `background_task` in `backend/registry_backend/settings.py`:

```python
INSTALLED_APPS = [
    # ... other apps ...
    'background_task',  # Uncomment this line
    # ... rest of apps ...
]
```

### 3. Restart Backend Server
```bash
# Stop the current server (Ctrl+C)
# Then restart it
python manage.py runserver
```

### 4. Start Background Worker (Optional, for tracking to work)
In a separate terminal:
```bash
cd backend
source venv/bin/activate
python manage.py process_tasks
```

## Current Status

✅ **Backend should start now** - tracking is disabled but won't crash the server
⚠️ **Tracking won't work** until migrations are run and background_task is enabled
✅ **All other functionality works normally**

## Verification

1. Check if backend starts: `curl http://localhost:8000/api/events/`
2. Check Django admin: `http://localhost:8000/api/admin/`
3. After migrations, check tracking works by viewing an invite page with a guest token
