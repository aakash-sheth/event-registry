"""
Seed script to create demo data
Run with: python manage.py shell < seed.py
Or: python manage.py shell, then paste this code
"""
from apps.users.models import User
from apps.events.models import Event
from apps.items.models import RegistryItem
from django.utils import timezone
from datetime import timedelta

# Create demo host
host, created = User.objects.get_or_create(
    email='demo@example.com',
    defaults={'name': 'Demo Host', 'is_active': True}
)
print(f"Host: {host.email} ({'created' if created else 'exists'})")

# Create demo event
event, created = Event.objects.get_or_create(
    slug='demo-wedding',
    defaults={
        'host': host,
        'title': 'John & Jane Wedding',
        'event_type': 'wedding',
        'date': timezone.now().date() + timedelta(days=30),
        'city': 'Mumbai',
        'is_public': True,
    }
)
print(f"Event: {event.title} ({'created' if created else 'exists'})")

# Create demo items
items_data = [
    {
        'name': 'Dining Table Set',
        'description': 'Beautiful 6-seater dining table with chairs',
        'price_inr': 50000,  # ₹500 in paise
        'qty_total': 1,
        'priority_rank': 1,
    },
    {
        'name': 'Coffee Maker',
        'description': 'Premium espresso machine',
        'price_inr': 25000,  # ₹250 in paise
        'qty_total': 2,
        'priority_rank': 2,
    },
    {
        'name': 'Bedroom Set',
        'description': 'King-size bed with mattress and wardrobe',
        'price_inr': 100000,  # ₹1000 in paise
        'qty_total': 1,
        'priority_rank': 0,
    },
    {
        'name': 'Kitchen Appliances',
        'description': 'Complete set of kitchen appliances',
        'price_inr': 75000,  # ₹750 in paise
        'qty_total': 1,
        'priority_rank': 3,
    },
]

for item_data in items_data:
    item, created = RegistryItem.objects.get_or_create(
        event=event,
        name=item_data['name'],
        defaults={
            'description': item_data['description'],
            'price_inr': item_data['price_inr'],
            'qty_total': item_data['qty_total'],
            'priority_rank': item_data['priority_rank'],
            'status': 'active',
        }
    )
    print(f"Item: {item.name} ({'created' if created else 'exists'})")

print("\n✅ Seed data created successfully!")
print(f"\nPublic registry URL: http://localhost:3000/registry/{event.slug}")
print(f"Host login: http://localhost:3000/host/login")
print(f"Demo email: {host.email}")

