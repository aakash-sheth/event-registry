"""
Django management command to seed the four default invite design templates into the database.

Creates Minimal, Classic, Emerald Mist, and Garden Soirée if they do not already exist
(keyed by name). Idempotent: re-running does not create duplicates.

Usage:
    python manage.py seed_invite_templates

Requires at least one staff user (created_by). Create a staff user first if needed.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.events.models import InviteDesignTemplate

User = get_user_model()

# Fixed date for config (JSON-serializable); frontend will format for display
SEED_DATE = '2025-06-14'
# Same default hero image URL as frontend lib/brand_utility (GENERIC_ENVELOPE_IMAGE)
DEFAULT_HERO_IMAGE = (
    'https://event-registry-staging-uploads-1764200910.s3.amazonaws.com/'
    'events/ekfern_banner/ekfern_envelope.png'
)


def get_minimal_config():
    return {
        'themeId': 'minimal-ivory',
        'customColors': {},
        'texture': {'type': 'none', 'intensity': 40},
        'tiles': [
            {
                'id': 'tile-title-0',
                'type': 'title',
                'enabled': True,
                'order': 0,
                'settings': {
                    'text': 'Event Title',
                    'font': "'Playfair Display', serif",
                    'color': '#121212',
                    'size': 'large',
                },
            },
            {
                'id': 'tile-event-details-1',
                'type': 'event-details',
                'enabled': True,
                'order': 1,
                'settings': {
                    'location': '',
                    'date': SEED_DATE,
                    'fontColor': '#121212',
                    'borderStyle': 'elegant',
                    'borderColor': '#D1D5DB',
                },
            },
            {
                'id': 'tile-feature-buttons-2',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 2,
                'settings': {
                    'buttonColor': '#0D6EFD',
                    'rsvpLabel': 'RSVP',
                    'registryLabel': 'View Registry',
                },
            },
        ],
    }


def get_classic_config():
    return {
        'themeId': 'classic-noir',
        'customColors': {},
        'texture': {'type': 'paper-grain', 'intensity': 18},
        'spacing': 'normal',
        'tiles': [
            {
                'id': 'tile-image-0',
                'type': 'image',
                'enabled': True,
                'order': 0,
                'settings': {
                    'src': DEFAULT_HERO_IMAGE,
                    'fitMode': 'fit-to-screen',
                    'shape': 'circle',
                    'frameStyle': 'single',
                    'frameColor': '#D4AF37',
                    'frameWidth': 2,
                },
            },
            {
                'id': 'tile-title-1',
                'type': 'title',
                'enabled': True,
                'order': 1,
                'overlayTargetId': 'tile-image-0',
                'settings': {
                    'text': 'Event Title',
                    'font': "'Great Vibes', cursive",
                    'color': '#FFFFFF',
                    'size': 'large',
                    'overlayMode': True,
                    'overlayPosition': {'x': 50, 'y': 50},
                },
            },
            {
                'id': 'tile-timer-2',
                'type': 'timer',
                'enabled': True,
                'order': 2,
                'settings': {
                    'enabled': True,
                    'format': 'circle',
                    'circleColor': '#E55A9E',
                    'textColor': '#FFFFFF',
                },
            },
            {
                'id': 'tile-event-details-3',
                'type': 'event-details',
                'enabled': True,
                'order': 3,
                'settings': {
                    'location': '',
                    'date': SEED_DATE,
                    'fontColor': '#FFFFFF',
                    'borderStyle': 'minimal',
                    'borderColor': 'rgba(255,255,255,0.45)',
                    'backgroundColor': 'transparent',
                    'dateLayout': 'day-prominent',
                },
            },
            {
                'id': 'tile-description-4',
                'type': 'description',
                'enabled': True,
                'order': 4,
                'settings': {
                    'content': '<p>A celebration to remember</p>',
                    'fontColor': '#E5E7EB',
                },
            },
            {
                'id': 'tile-feature-buttons-5',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 5,
                'settings': {'buttonColor': '#E55A9E', 'rsvpLabel': 'RSVP'},
            },
            {
                'id': 'tile-footer-6',
                'type': 'footer',
                'enabled': True,
                'order': 6,
                'settings': {
                    'text': "We can't wait to celebrate with you.",
                    'fontColor': '#B0B1B6',
                },
            },
        ],
    }


def get_emerald_config():
    return {
        'themeId': 'emerald-mist',
        'customColors': {},
        'texture': {'type': 'paper-grain', 'intensity': 26},
        'tiles': [
            {
                'id': 'tile-title-0',
                'type': 'title',
                'enabled': True,
                'order': 0,
                'settings': {
                    'text': 'Event Title',
                    'font': "'Cormorant Garamond', serif",
                    'color': '#FFFFFF',
                    'size': 'large',
                },
            },
            {
                'id': 'tile-timer-1',
                'type': 'timer',
                'enabled': True,
                'order': 1,
                'settings': {
                    'enabled': True,
                    'format': 'circle',
                    'circleColor': '#34d399',
                    'textColor': '#FFFFFF',
                },
            },
            {
                'id': 'tile-event-details-2',
                'type': 'event-details',
                'enabled': True,
                'order': 2,
                'settings': {
                    'location': '',
                    'date': SEED_DATE,
                    'fontColor': '#E6FCF5',
                    'borderStyle': 'minimal',
                    'borderColor': 'rgba(167,243,208,0.5)',
                    'backgroundColor': 'transparent',
                },
            },
            {
                'id': 'tile-feature-buttons-3',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 3,
                'settings': {'buttonColor': '#34d399', 'rsvpLabel': 'RSVP'},
            },
        ],
    }


def get_garden_config():
    return {
        'themeId': 'minimal-ivory',
        'customColors': {},
        'texture': {'type': 'linen', 'intensity': 15},
        'tiles': [
            {
                'id': 'tile-title-0',
                'type': 'title',
                'enabled': True,
                'order': 0,
                'settings': {
                    'text': 'Event Title',
                    'font': "'Playfair Display', serif",
                    'color': '#1F2937',
                    'size': 'large',
                },
            },
            {
                'id': 'tile-description-1',
                'type': 'description',
                'enabled': True,
                'order': 1,
                'settings': {
                    'content': '<p>Join us for an evening of celebration.</p>',
                    'fontColor': '#374151',
                },
            },
            {
                'id': 'tile-event-details-2',
                'type': 'event-details',
                'enabled': True,
                'order': 2,
                'settings': {
                    'location': '',
                    'date': SEED_DATE,
                    'fontColor': '#1F2937',
                    'borderStyle': 'elegant',
                    'borderColor': '#9CA3AF',
                    'backgroundColor': 'transparent',
                },
            },
            {
                'id': 'tile-feature-buttons-3',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 3,
                'settings': {
                    'buttonColor': '#059669',
                    'rsvpLabel': 'RSVP',
                    'registryLabel': 'View Registry',
                },
            },
        ],
    }


DEFAULT_TEMPLATES = [
    {
        'name': 'Minimal',
        'description': 'Clean and simple: title, date & place, and actions.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Minimal invite template preview with light background and clean typography',
        'config_fn': get_minimal_config,
    },
    {
        'name': 'Classic',
        'description': 'Full layout with hero image, countdown, details, and footer.',
        'thumbnail': '/invite-templates/classic.svg',
        'preview_alt': 'Classic invite template preview with dark elegant styling and countdown',
        'config_fn': get_classic_config,
    },
    {
        'name': 'Emerald Mist',
        'description': 'Elegant green theme with countdown and details.',
        'thumbnail': '/invite-templates/emerald.svg',
        'preview_alt': 'Emerald Mist invite template preview with rich green theme',
        'config_fn': get_emerald_config,
    },
    {
        'name': 'Garden Soirée',
        'description': 'Light, refined layout with description block and map-ready details.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Garden Soirée invite with description and borders',
        'config_fn': get_garden_config,
    },
]


class Command(BaseCommand):
    help = 'Seed the four default invite design templates (Minimal, Classic, Emerald Mist, Garden Soirée)'

    def handle(self, *args, **options):
        seed_user = User.objects.filter(is_staff=True).first() or User.objects.filter(is_superuser=True).first()
        if not seed_user:
            self.stdout.write(
                self.style.ERROR('No staff or superuser found. Create a staff user first, then run this command.')
            )
            return

        created_count = 0
        for spec in DEFAULT_TEMPLATES:
            config = spec['config_fn']()
            obj, created = InviteDesignTemplate.objects.get_or_create(
                name=spec['name'],
                defaults={
                    'description': spec['description'],
                    'thumbnail': spec['thumbnail'],
                    'preview_alt': spec['preview_alt'],
                    'config': config,
                    'visibility': 'public',
                    'status': 'published',
                    'created_by': seed_user,
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created template: {obj.name} (id={obj.id})'))
            else:
                self.stdout.write(f'Template already exists: {obj.name}')

        self.stdout.write(self.style.SUCCESS(f'Done. Created {created_count} new template(s).'))
