# Wedding Registry Backend

Django + Django REST Framework backend for the wedding registry MVP.

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

