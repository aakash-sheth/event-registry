#!/bin/bash
set -e

echo "=========================================="
echo "Testing Security Fixes in Docker"
echo "=========================================="

# Check if Docker is running
if ! docker ps > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Check if containers are running
if ! docker-compose ps | grep -q "backend.*Up"; then
    echo "Starting Docker containers..."
    docker-compose up -d db
    echo "Waiting for database to be ready..."
    sleep 5
    docker-compose up -d backend
    echo "Waiting for backend to be ready..."
    sleep 10
fi

echo ""
echo "1. Running existing Django tests..."
docker-compose exec -T backend python manage.py test apps.events.tests --verbosity=2

echo ""
echo "2. Testing that public GET endpoint doesn't write to database..."
docker-compose exec -T backend python manage.py shell << 'PYTHON'
from django.test import Client
from apps.events.models import Event, InvitePage
from django.contrib.auth import get_user_model

User = get_user_model()
client = Client()

# Create test event
host = User.objects.create_user(email='test@test.com', name='Test Host')
event = Event.objects.create(
    host=host,
    slug='test-no-invite',
    title='Test Event',
    is_public=True
)

# Count invite pages before
initial_count = InvitePage.objects.count()
print(f"Initial invite page count: {initial_count}")

# Try to access public endpoint (should return 404, not create)
response = client.get(f'/api/events/invite/{event.slug}/')
print(f"Response status: {response.status_code}")
print(f"Response content: {response.content[:200]}")

# Count invite pages after
final_count = InvitePage.objects.count()
print(f"Final invite page count: {final_count}")

if final_count == initial_count:
    print("✓ PASS: No invite page was created")
else:
    print(f"✗ FAIL: Invite page count changed from {initial_count} to {final_count}")
    exit(1)

# Cleanup
event.delete()
host.delete()
print("Test completed successfully")
PYTHON

echo ""
echo "3. Testing that debug info doesn't leak PII..."
docker-compose exec -T backend python manage.py shell << 'PYTHON'
from django.test import Client
from django.conf import settings
from apps.events.models import Event, RSVP
from django.contrib.auth import get_user_model

User = get_user_model()
client = Client()

# Create test event and RSVP
host = User.objects.create_user(email='test2@test.com', name='Test Host')
event = Event.objects.create(
    host=host,
    slug='test-event',
    title='Test Event',
    is_public=True,
    has_rsvp=True
)

# Create RSVP with phone number
RSVP.objects.create(
    event=event,
    name='Test Guest',
    phone='+1234567890',
    will_attend='yes'
)

# Try to get RSVP with non-existent phone
response = client.get(
    f'/api/events/{event.id}/rsvp/check/',
    {'phone': '+9999999999'}
)

print(f"Response status: {response.status_code}")
response_data = response.json()
print(f"Response keys: {list(response_data.keys())}")

if 'debug' in response_data:
    if 'all_phones_in_db' in response_data['debug']:
        print("✗ FAIL: PII (phone numbers) leaked in debug response")
        exit(1)
    else:
        print("✓ PASS: Debug info present but no PII")
else:
    print("✓ PASS: No debug info in response (best case)")

# Cleanup
event.delete()
host.delete()
print("Test completed successfully")
PYTHON

echo ""
echo "=========================================="
echo "All tests passed! ✓"
echo "=========================================="

