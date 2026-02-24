# Quick Start Guide

## 🚀 Get Running in 5 Minutes

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env - at minimum set:
# - DATABASE_URL (or DB_* variables)
# - DJANGO_SECRET_KEY (generate one)

# Start PostgreSQL (or use Docker)
docker-compose up -d db  # From project root

# Run migrations
python manage.py migrate

# Seed demo data (optional)
python manage_seed.py

# Start server
python manage.py runserver
```

### 2. Frontend Setup

```bash
cd frontend
npm install

# Create .env.local
cp .env.example .env.local
# Edit .env.local:
# - NEXT_PUBLIC_API_BASE=http://localhost:8000
# - NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key

# Start dev server
npm run dev
```

### 3. Test the Flow

1. **Visit:** http://localhost:3000/host/login
2. **Demo account** (if you ran seed script): email `demo@example.com`, password `demo1234`
3. Or use **OTP**: enter your email → check email for code → login with code
4. **Create event** or view existing
5. **Add items** to registry
6. **Visit public registry:** http://localhost:3000/registry/demo-wedding
7. **Test checkout** with Razorpay test cards

## 🔧 Configuration Checklist

### Required for MVP

- [ ] PostgreSQL database
- [ ] Razorpay test account & keys
- [ ] AWS SES email configuration - optional for testing

### Optional

- [ ] AWS S3 for image uploads
- [ ] Production domain & SSL
- [ ] Webhook URL configured in Razorpay

## 🧪 Testing Payments

Use Razorpay test cards:
- **Success:** 4111 1111 1111 1111
- **Failure:** 4000 0000 0000 0002
- CVV: Any 3 digits
- Expiry: Any future date

## 📧 Email Setup

For development, you can skip email setup - OTP codes will be logged/returned in response.

For production:
- **AWS SES:** Verify domain/email in SES console, set SES_REGION and SES_FROM_EMAIL
- Ensure IAM role has SES send permissions

## 🐛 Common Issues

**Backend won't start:**
- Check PostgreSQL is running
- Verify DATABASE_URL in .env

**Frontend can't connect:**
- Check NEXT_PUBLIC_API_BASE matches backend URL
- Verify CORS settings in backend

**Payments not working:**
- Check Razorpay keys are set
- Verify webhook URL in Razorpay dashboard

