# Guest Invite Analytics Implementation

## Overview
This implementation adds comprehensive tracking for guest invite link engagement, allowing hosts to see:
- Which guests opened their personalized invite links
- How many times each link was viewed
- Which guests opened the RSVP page
- Overall engagement metrics

## Implementation Details

### Backend Changes

#### 1. Database Models (`backend/apps/events/models.py`)
- **InvitePageView**: Tracks when a guest opens their personalized invite page
- **RSVPPageView**: Tracks when a guest opens the RSVP page
- Both models include proper indexes for efficient queries

#### 2. Background Tasks (`backend/apps/events/tasks.py`)
- **track_invite_page_view()**: Async background task to record invite page views
- **track_rsvp_page_view()**: Async background task to record RSVP page views
- Tasks run asynchronously using `django-background-tasks` to ensure **zero performance impact** on page load

#### 3. Tracking Integration
- **Invite Page Tracking**: Added to `PublicInviteViewSet.retrieve()` - tracks when guests open invite pages with `guest_token`
- **RSVP Page Tracking**: Added to `get_guest_by_token()` - tracks when guests open RSVP pages

#### 4. Analytics API Endpoints
- **GET `/api/events/{id}/guests/analytics/`**: Returns analytics for all guests
- **GET `/api/events/{id}/analytics/summary/`**: Returns event-level summary statistics

#### 5. Dependencies
- Added `django-background-tasks==1.2.8` to `requirements.txt`
- Added `background_task` to `INSTALLED_APPS` in `settings.py`

### Frontend Changes

#### 1. API Functions (`frontend/lib/api.ts`)
- `getGuestsAnalytics()`: Fetches per-guest analytics
- `getEventAnalyticsSummary()`: Fetches event-level summary

#### 2. Guests Page Updates (`frontend/app/host/events/[eventId]/guests/page.tsx`)
- **Analytics Summary Card**: Shows overall engagement metrics at the top
- **Analytics Column**: Added to guest table showing:
  - Invite view count with last view date
  - RSVP view count with last view date
  - Visual indicators (blue for invite, purple for RSVP)

## Performance Considerations

✅ **Zero Performance Impact on Page Load**
- All tracking happens asynchronously in background tasks
- Database writes are non-blocking
- Errors in tracking don't affect user experience
- Proper database indexes ensure fast queries

## Next Steps

### 1. Run Database Migrations
```bash
cd backend
source venv/bin/activate  # or activate your virtual environment
python manage.py makemigrations events
python manage.py migrate
```

### 2. Start Background Task Worker
The background task worker needs to be running to process tracking tasks:

```bash
cd backend
python manage.py process_tasks
```

**For Production (Docker/ECS):**
- Add a separate container/service that runs `python manage.py process_tasks`
- Or use a cron job to run it periodically
- Consider using AWS ECS scheduled tasks or a separate worker service

### 3. Verify Tracking
1. Open an invite page with a `guest_token` query parameter
2. Check the database to see if `InvitePageView` records are created
3. Open an RSVP page with a `guest_token`
4. Check if `RSVPPageView` records are created
5. View the analytics on the guests page in the host dashboard

## Database Schema

### InvitePageView
- `guest` (ForeignKey to Guest)
- `event` (ForeignKey to Event)
- `viewed_at` (DateTime, auto-created)
- Indexes on `(guest, -viewed_at)` and `(event, -viewed_at)`

### RSVPPageView
- `guest` (ForeignKey to Guest)
- `event` (ForeignKey to Event)
- `viewed_at` (DateTime, auto-created)
- Indexes on `(guest, -viewed_at)` and `(event, -viewed_at)`

## Privacy & Compliance

✅ **Privacy Compliant**
- No device fingerprinting
- No IP address storage
- No browser/user-agent tracking
- Only tracks page views linked to guest tokens (which guests already have)
- Server-side only (no client-side tracking scripts)

## Analytics Features

### Per-Guest Analytics
- Invite view count
- RSVP view count
- Last invite view timestamp
- Last RSVP view timestamp
- Boolean flags for "has viewed invite" and "has viewed RSVP"

### Event-Level Summary
- Total guests
- Guests who viewed invite (count and percentage)
- Guests who viewed RSVP (count and percentage)
- Total invite views
- Total RSVP views
- Engagement rate (guests who viewed both)

## Troubleshooting

### Tracking Not Working
1. Check if background task worker is running: `python manage.py process_tasks`
2. Check Django logs for tracking errors
3. Verify `django-background-tasks` is installed and configured
4. Check database for `background_task` table (created automatically)

### Analytics Not Showing
1. Verify migrations have been run
2. Check if analytics API endpoints return data
3. Check browser console for API errors
4. Ensure guest tokens are present in invite URLs

## Future Enhancements

Potential additions:
- Device/browser information (if privacy-compliant)
- Time-series analytics (views over time)
- Export analytics to CSV
- Email notifications for engagement milestones
- Comparison with previous events
