from django.db import migrations
import secrets


def backfill_guest_tokens(apps, schema_editor):
    """
    Ensure all existing guests have a guest_token.

    Tokens are required for personalized invite variables and RSVP autofill.
    """
    Guest = apps.get_model('events', 'Guest')

    # Only backfill missing tokens; leave existing tokens stable.
    qs = Guest.objects.filter(guest_token__isnull=True)

    for guest in qs.iterator():
        # Very low collision probability; retry defensively.
        for _ in range(5):
            token = secrets.token_urlsafe(32)
            if not Guest.objects.filter(guest_token=token).exists():
                guest.guest_token = token
                guest.save(update_fields=['guest_token'])
                break


class Migration(migrations.Migration):
    dependencies = [
        ('events', '0036_normalize_font_families'),
    ]

    operations = [
        migrations.RunPython(backfill_guest_tokens, reverse_code=migrations.RunPython.noop),
    ]

