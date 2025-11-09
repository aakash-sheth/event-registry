# Running with Docker

## Quick Start

1. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

2. **Run in background:**
   ```bash
   docker-compose up -d --build
   ```

3. **View logs:**
   ```bash
   docker-compose logs -f
   ```

4. **Stop services:**
   ```bash
   docker-compose down
   ```

## Services

- **Database (PostgreSQL)**: `localhost:5432`
- **Backend API**: `http://localhost:8000`
- **Frontend**: `http://localhost:3000`

## First Time Setup

### 1. Seed Database (Optional)

After starting the containers, seed demo data:

```bash
docker-compose exec backend python manage_seed.py
```

### 2. Create Admin User (Optional)

```bash
docker-compose exec backend python manage.py createsuperuser
```

## Environment Variables

### Using .env file

Create a `.env` file in the project root:

```bash
RAZORPAY_KEY_ID=your_key
RAZORPAY_KEY_SECRET=your_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_public_key
```

Docker Compose will automatically load these variables.

### Using docker-compose.override.yml

Create `docker-compose.override.yml` (gitignored) for local overrides:

```yaml
version: '3.8'
services:
  backend:
    environment:
      - RAZORPAY_KEY_ID=your_key
```

## Common Commands

### Run migrations
```bash
docker-compose exec backend python manage.py migrate
```

### Access backend shell
```bash
docker-compose exec backend python manage.py shell
```

### Access database
```bash
docker-compose exec db psql -U postgres -d registry
```

### Rebuild after code changes
```bash
docker-compose up --build
```

### View specific service logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f db
```

### Restart a service
```bash
docker-compose restart backend
```

## Troubleshooting

### Port already in use
If ports 3000, 8000, or 5432 are already in use, stop the conflicting services or change ports in `docker-compose.yml`.

### Database connection errors
Wait a few seconds after starting - the backend waits for the database to be ready.

### Frontend can't connect to backend
Check that `NEXT_PUBLIC_API_BASE=http://localhost:8000` is set correctly in the frontend environment.

### Permission errors
On Linux/Mac, you may need to fix permissions:
```bash
sudo chown -R $USER:$USER .
```

### Clear everything and start fresh
```bash
docker-compose down -v  # Removes volumes too
docker-compose up --build
```

## Development Workflow

The Docker setup uses volume mounts, so code changes are reflected immediately:

- **Backend**: Changes to Python files are picked up automatically (Django auto-reload)
- **Frontend**: Next.js hot-reload works in the container

No need to rebuild unless you change dependencies (`requirements.txt` or `package.json`).

## Production Build

For production, you'd want to:

1. Use production Dockerfiles (multi-stage builds)
2. Set `DEBUG=False`
3. Use proper secrets management
4. Configure reverse proxy (nginx)
5. Use production database

See deployment section in main README.

