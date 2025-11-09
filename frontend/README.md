# Wedding Registry Frontend

Next.js 14 frontend for the wedding registry MVP.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Copy `.env.example` to `.env.local` and fill in your values.

3. **Run development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   npm start
   ```

## Pages

### Public
- `/registry/[slug]` - Public registry page
- `/success` - Payment success page

### Host (Protected)
- `/host/login` - OTP login
- `/host/dashboard` - Events dashboard
- `/host/events/new` - Create event
- `/host/events/[eventId]` - Event management
- `/host/items/[eventId]` - Items management

## Deployment

Deploy to Vercel:

```bash
vercel
```

Or configure for S3 + CloudFront.

