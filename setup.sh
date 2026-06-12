#!/bin/bash
set -e

echo "Setting up ekfern-core..."

# Git hooks
echo "Activating git hooks..."
git config core.hooksPath .githooks
echo "  pre-push hook active (blocks direct pushes to main)"

# Backend
echo "Setting up backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created backend/.env from .env.example — fill in your values"
fi
cd ..

# Frontend
echo "Setting up frontend..."
cd frontend
npm install --silent
if [ ! -f .env.local ]; then
  cp .env.example .env.local 2>/dev/null || true
  echo "  Created frontend/.env.local — fill in your values"
fi
cd ..

echo ""
echo "Setup complete. Next steps:"
echo "  1. Edit backend/.env with your database and API credentials"
echo "  2. Edit frontend/.env.local with NEXT_PUBLIC_API_BASE"
echo "  3. Start the DB:       docker-compose up -d db"
echo "  4. Run migrations:     cd backend && python manage.py migrate"
echo "  5. Start backend:      python manage.py runserver"
echo "  6. Start frontend:     cd frontend && npm run dev"
