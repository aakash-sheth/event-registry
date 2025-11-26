#!/bin/bash

# Script to run the event registry app with Docker

set -e

echo "🚀 Starting Event Registry with Docker..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Build and start services
echo "📦 Building and starting services..."
docker-compose up --build -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo ""
    echo "✅ Services are running!"
    echo ""
    echo "📍 Access the application:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend API: http://localhost:8000"
    echo "   Database: localhost:5432"
    echo ""
    echo "📝 Useful commands:"
    echo "   View logs: docker-compose logs -f"
    echo "   Stop: docker-compose down"
    echo "   Seed data: docker-compose exec backend python manage_seed.py"
    echo ""
else
    echo "❌ Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi

