# Event Registry Backend

Django + Django REST Framework backend for the event registry MVP.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment:**
   Copy `.env.example` to `.env` and fill in your values.

3. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

4. **Create superuser (optional):**
   ```bash
   python manage.py createsuperuser
   ```

5. **Run development server:**
   ```bash
   python manage.py runserver
   ```

## API Endpoints

### Authentication
- `POST /api/auth/otp/start` - Request OTP
- `POST /api/auth/otp/verify` - Verify OTP and get JWT
- `GET /api/auth/me` - Get current user

### Events (Host only)
- `GET /api/events` - List host's events
- `POST /api/events` - Create event
- `GET /api/events/{id}` - Get event details
- `PUT /api/events/{id}` - Update event
- `GET /api/events/{id}/orders.csv` - Export orders CSV

### Items (Host only)
- `GET /api/items?event_id={id}` - List items for event
- `POST /api/items` - Create item (include `event_id` in body)
- `PUT /api/items/{id}` - Update item
- `DELETE /api/items/{id}` - Delete item

### Public Registry
- `GET /api/registry/{slug}` - Get public event details
- `GET /api/registry/{slug}/items` - Get active items for event

### Orders
- `POST /api/orders` - Create order (public)
- `GET /api/orders/{id}` - Get order (host only)
- `POST /api/payments/razorpay/webhook` - Razorpay webhook

## Testing

```bash
python manage.py test
```

## Deployment

The backend can be deployed to:
- Render (recommended for MVP)
- AWS ECS
- Heroku
- Any platform supporting Django

Ensure environment variables are set correctly in production.

## Analytics Batch Processing

The analytics system uses batch processing to reduce database load. Page views are collected in cache and processed periodically.

### Setup

1. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

2. **Set up scheduled task** (choose one method):

   **Option A: Using background_task scheduler (Recommended for Docker)**
   
   The batch processing is automatically scheduled when the `backend-worker` service starts.
   The docker-compose.yml is already configured to schedule it automatically.
   
   To manually schedule (if needed):
   ```bash
   python manage.py schedule_analytics_batch
   ```
   
   To clear and reschedule:
   ```bash
   python manage.py schedule_analytics_batch --clear
   ```

   **Option B: Using Cron (Alternative for non-Docker deployments)**
   ```bash
   # Add to crontab (crontab -e)
   # Process every 30 minutes
   */30 * * * * cd /path/to/backend && python manage.py process_analytics_batch
   ```
   
   **Option C: Manual scheduling in code**
   ```python
   # In a management command or startup script
   from apps.events.tasks import process_analytics_batch
   from background_task import background
   
   @background(schedule=1800)  # 30 minutes in seconds
   def schedule_batch_processing():
       process_analytics_batch()
       schedule_batch_processing()  # Reschedule itself
   ```

3. **Configuration:**
   - `ANALYTICS_BATCH_INTERVAL_MINUTES`: Batch processing interval in minutes
     - Default: 2 minutes for development (DEBUG=True), 30 minutes for production
     - For local testing, you can set to 1 minute: `ANALYTICS_BATCH_INTERVAL_MINUTES=1`
   - `ANALYTICS_BATCH_CACHE_PREFIX`: Cache key prefix (default: 'analytics_pending')

### Manual Processing

To manually trigger batch processing:
```bash
python manage.py process_analytics_batch
```

To view statistics:
```bash
python manage.py process_analytics_batch --stats
```

### Monitoring

View batch processing status in Django admin:
- Navigate to `/api/admin/analytics-batch/` for dashboard
- Or go to Events > Analytics Batch Runs for detailed view

### Cache Requirements

- **Development**: LocMemCache works but has limitations (no key scanning)
- **Production**: Redis recommended for better performance and key scanning support
