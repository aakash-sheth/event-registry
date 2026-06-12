# Ekfern Core

Full-stack [Ekfern](https://github.com/Ekfern/ekfern-core) application built with Django REST Framework and Next.js 14. Supports invitations, RSVP, host catalogs, and guest management for any type of event.

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (optional, for local development)

### Local Development

1. **Clone and setup:**

   ```bash
   git clone https://github.com/Ekfern/ekfern-core.git
   cd ekfern-core
   ```

   Then run the setup script (installs dependencies and activates git hooks):

   ```bash
   bash setup.sh
   ```

   Or activate the git hooks manually:

   ```bash
   git config core.hooksPath .githooks
   ```

   > This enables the pre-push hook that blocks accidental direct pushes to `main`.

2. **Backend Setup:**

   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup:**

   ```bash
   # Using Docker Compose (recommended)
   cd ..
   docker-compose up -d db
   
   # Or use local PostgreSQL
   # Create database: createdb registry
   ```

4. **Run Migrations:**

   ```bash
   cd backend
   python manage.py migrate
   ```

5. **Seed Demo Data (optional):**

   ```bash
   python manage_seed.py
   ```

6. **Start Backend:**

   ```bash
   python manage.py runserver
   # Backend runs on http://localhost:8000
   ```

7. **Frontend Setup:**

   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

8. **Start Frontend:**

   ```bash
   npm run dev
   # Frontend runs on http://localhost:3000
   ```

## 📁 Project Structure

```
ekfern-core/
├── backend/              # Django REST API
│   ├── apps/
│   │   ├── users/       # User authentication (OTP)
│   │   ├── events/      # Event management
│   │   ├── items/       # Registry items
│   │   ├── orders/      # Orders & payments
│   │   ├── notifications/ # Email/WhatsApp logs
│   │   └── common/      # Shared utilities
│   └── manage.py
├── frontend/            # Next.js 14 App
│   ├── app/
│   │   ├── (host)/     # Host dashboard pages
│   │   ├── registry/   # Public registry pages
│   │   └── success/    # Payment success
│   └── components/     # React components
└── docker-compose.yml   # Local development setup
```

## 🔑 Environment Variables

### Backend (.env)

See `backend/.env.example` for all variables. Key ones:

- `DATABASE_URL` - PostgreSQL connection string
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET` - Razorpay credentials
- `SES_REGION` - AWS SES region (e.g., `us-east-1`)
- `SES_FROM_EMAIL` - Email address for sending emails via SES
- `FRONTEND_ORIGIN` - Frontend URL for CORS

### Frontend (.env.local)

- `NEXT_PUBLIC_API_BASE` - Backend API URL
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` - Razorpay public key

## 🧪 Testing

### Backend Tests

```bash
cd backend
python manage.py test
```

### Manual Testing Flow

1. **Create Host Account:**
   - Go to `/host/login`
   - Demo (after seeding): `demo@example.com` / `demo1234`
   - Or enter email, receive OTP, verify and login

2. **Create Event:**
   - Dashboard → Create New Event
   - Fill event details, create

3. **Add Items:**
   - Event → Manage Items
   - Add registry items with prices

4. **Test Public Registry:**
   - Visit `/registry/{slug}`
   - Browse items, click "Gift This"

5. **Test Checkout:**
   - Fill guest details
   - Complete Razorpay payment (use test cards)
   - Verify success page and emails

6. **View Orders:**
   - Host dashboard → Event → View orders
   - Export CSV

## 🚢 Deployment

### Backend (Render/ECS)

1. **Build Docker image** or use Render's Python buildpack
2. **Set environment variables** in deployment platform
3. **Run migrations:** `python manage.py migrate`
4. **Configure webhook URL** in Razorpay dashboard:
   - `https://your-backend.com/api/payments/razorpay/webhook`

### Frontend (Vercel)

1. **Connect repository** [`Ekfern/ekfern-core`](https://github.com/Ekfern/ekfern-core) to Vercel
2. **Set environment variables**
3. **Deploy** - Vercel auto-detects Next.js

### Database

- Use managed PostgreSQL (Render, AWS RDS, etc.)
- Update `DATABASE_URL` in backend env

## 🔒 Security Checklist

- [x] Razorpay webhook signature verification
- [x] Server-side price validation
- [x] Atomic inventory updates (transactions)
- [x] JWT authentication for host routes
- [x] CORS configuration
- [ ] Rate limiting (basic throttle on OTP)
- [ ] HTTPS in production
- [ ] Environment variable validation

## 📝 API Documentation

### Authentication

- `POST /api/auth/otp/start` - Request OTP
- `POST /api/auth/otp/verify` - Verify OTP, get JWT
- `GET /api/auth/me` - Get current user

### Events (Host)

- `GET /api/events` - List events
- `POST /api/events` - Create event
- `GET /api/events/{id}` - Get event
- `PUT /api/events/{id}` - Update event
- `GET /api/events/{id}/orders` - Get orders
- `GET /api/events/{id}/orders.csv` - Export CSV

### Items (Host)

- `GET /api/items?event_id={id}` - List items
- `POST /api/items` - Create item
- `PUT /api/items/{id}` - Update item
- `DELETE /api/items/{id}` - Delete item

### Public Registry

- `GET /api/registry/{slug}` - Get event
- `GET /api/registry/{slug}/items` - Get active items

### Orders

- `POST /api/orders` - Create order (public)
- `GET /api/orders/{id}` - Get order (host)
- `POST /api/payments/razorpay/webhook` - Razorpay webhook

## 🐛 Troubleshooting

### Backend won't start

- Check PostgreSQL is running
- Verify `DATABASE_URL` in `.env`
- Run `python manage.py migrate`

### Frontend can't connect to API

- Check `NEXT_PUBLIC_API_BASE` in `.env.local`
- Verify backend is running on correct port
- Check CORS settings in backend

### Razorpay payment fails

- Verify Razorpay keys are set
- Check webhook URL is configured
- Use Razorpay test mode for development

### Emails not sending

- Verify AWS SES credentials and permissions
- Check SES_REGION and SES_FROM_EMAIL settings
- Ensure email/domain is verified in SES (if in sandbox mode)
- Check notification logs in admin panel

## 📚 Next Steps (Deferred Features)

- WhatsApp notifications
- Multi-language support
- Gift reminders
- Thank-you automation
- Analytics dashboard

## 📄 License

MIT

