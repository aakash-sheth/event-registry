"""
Management command to send daily digest emails to hosts who have chosen
'daily_digest' frequency for RSVP or gift notifications.

Usage:
    python manage.py send_digests
    python manage.py send_digests --dry-run   # preview without sending

Schedule via cron (runs daily at 8 AM server time):
    0 8 * * * /path/to/venv/bin/python manage.py send_digests

Or via ECS scheduled task / Fargate cron with the same command.
"""
import logging
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from django.db import transaction

from apps.notifications.models import NotificationQueue
from apps.common.email_backend import send_email

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Send daily digest emails for batched RSVP and gift notifications'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview digest emails without actually sending or marking as sent',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        logger.info(f'Starting send_digests (dry_run={dry_run})')

        pending = (
            NotificationQueue.objects
            .filter(sent_at__isnull=True)
            .select_related('user', 'user__notification_preferences')
        )
        total = pending.count()

        if not total:
            self.stdout.write('No pending digest notifications.')
            logger.info('send_digests: nothing to send')
            return

        logger.info(f'send_digests: found {total} pending items across all users')

        # Group by user
        by_user = defaultdict(list)
        for item in pending:
            by_user[item.user].append(item)

        sent_count = 0
        failed_count = 0

        for user, items in by_user.items():
            prefs = getattr(user, 'notification_preferences', None)
            unsubscribe_token = prefs.unsubscribe_token if prefs else None

            rsvps = [i for i in items if i.notification_type == 'rsvp_new']
            gifts = [i for i in items if i.notification_type == 'gift_received']

            sections = []

            if rsvps:
                lines = [
                    f"  - {r.payload_json.get('rsvp_name', 'Guest')} "
                    f"({r.payload_json.get('will_attend', '?')}) "
                    f"for {r.payload_json.get('event_title', 'your event')}"
                    for r in rsvps
                ]
                sections.append(f"NEW RSVPs ({len(rsvps)}):\n" + "\n".join(lines))

            if gifts:
                lines = [
                    f"  - \u20b9{g.payload_json.get('amount_rupees', '?')} from "
                    f"{g.payload_json.get('buyer_name', 'Someone')} "
                    f"for {g.payload_json.get('item_name', 'a gift')} "
                    f"({g.payload_json.get('event_title', 'your event')})"
                    for g in gifts
                ]
                sections.append(f"NEW GIFTS ({len(gifts)}):\n" + "\n".join(lines))

            if not sections:
                continue

            subject = f"Your Ekfern daily digest \u2013 {timezone.localdate().strftime('%B %d')}"
            body = (
                f"Hi {user.name or 'there'},\n\n"
                f"Here's a summary of activity on your events:\n\n"
                + "\n\n".join(sections)
                + f"\n\nView your dashboard: {settings.FRONTEND_ORIGIN}/host/dashboard"
            )

            if dry_run:
                self.stdout.write(f'  [DRY RUN] Would send digest to {user.email} '
                                  f'({len(rsvps)} RSVPs, {len(gifts)} gifts)')
                self.stdout.write(f'  Subject: {subject}')
                sent_count += 1
                continue

            now = timezone.now()
            try:
                send_email(
                    to_email=user.email,
                    subject=subject,
                    body_text=body,
                    unsubscribe_token=unsubscribe_token,
                )
                with transaction.atomic():
                    NotificationQueue.objects.filter(
                        id__in=[i.id for i in items]
                    ).update(sent_at=now)
                sent_count += 1
                logger.info(f'Digest sent to {user.email} ({len(rsvps)} RSVPs, {len(gifts)} gifts)')
                self.stdout.write(f'  Sent digest to {user.email} ({len(rsvps)} RSVPs, {len(gifts)} gifts)')
            except Exception as e:
                failed_count += 1
                logger.error(f'Failed to send digest to {user.email}: {e}', exc_info=True)
                self.stderr.write(f'  Failed to send digest to {user.email}: {e}')

        summary = f'Done. Users processed: {sent_count}, Failed: {failed_count}'
        self.stdout.write(self.style.SUCCESS(summary))
        logger.info(f'send_digests complete: {summary}')
