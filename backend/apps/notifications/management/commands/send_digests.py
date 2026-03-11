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
from django.db.models import Sum

from apps.notifications.models import NotificationQueue, StaffNotificationRecipient
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

        self._send_business_digest(dry_run)

    def _send_business_digest(self, dry_run):
        """Send daily business metrics summary to all active staff recipients."""
        recipients = StaffNotificationRecipient.objects.filter(receive_daily_digest=True, is_active=True)
        if not recipients.exists():
            logger.info('send_digests: no staff recipients configured for business digest')
            return

        # Late imports to avoid circular dependencies
        from django.contrib.auth import get_user_model
        from apps.events.models import Event, RSVP
        from apps.orders.models import Order

        User = get_user_model()
        today = timezone.localdate()

        # Today's metrics
        new_signups = User.objects.filter(date_joined__date=today).count()
        new_events = Event.objects.filter(created_at__date=today).count()
        new_rsvps = RSVP.objects.filter(created_at__date=today, is_removed=False).count()
        gifts_today_qs = Order.objects.filter(created_at__date=today, status='fulfilled')
        gifts_today_count = gifts_today_qs.count()
        gifts_today_inr = (gifts_today_qs.aggregate(total=Sum('amount_inr'))['total'] or 0) / 100

        # All-time metrics
        total_users = User.objects.count()
        total_events = Event.objects.count()
        total_revenue_inr = (
            Order.objects.filter(status='fulfilled').aggregate(total=Sum('amount_inr'))['total'] or 0
        ) / 100

        date_str = today.strftime('%B %d')
        subject = f"Ekfern business digest \u2013 {date_str}"
        frontend = getattr(settings, 'FRONTEND_ORIGIN', 'https://ekfern.com')

        gifts_line = (
            f"\u20b9{gifts_today_inr:,.0f} across {gifts_today_count} order{'s' if gifts_today_count != 1 else ''}"
            if gifts_today_count else "none"
        )

        body_template = (
            "Hi {name},\n\n"
            f"Here's your Ekfern business summary for {date_str}:\n\n"
            f"TODAY\n"
            f"  New signups:  {new_signups}\n"
            f"  New events:   {new_events}\n"
            f"  New RSVPs:    {new_rsvps}\n"
            f"  Gifts:        {gifts_line}\n\n"
            f"ALL TIME\n"
            f"  Total users:   {total_users}\n"
            f"  Total events:  {total_events}\n"
            f"  Total revenue: \u20b9{total_revenue_inr:,.0f}\n\n"
            f"View admin: {frontend}/api/admin/"
        )

        if dry_run:
            self.stdout.write(
                f'  [DRY RUN] Would send business digest to {recipients.count()} staff recipient(s)'
            )
            self.stdout.write(f'  Subject: {subject}')
            self.stdout.write(
                f'  Today: {new_signups} signups, {new_events} events, {new_rsvps} RSVPs, {gifts_line}'
            )
            return

        sent = 0
        for recipient in recipients:
            body = body_template.format(name=recipient.name or 'there')
            try:
                send_email(to_email=recipient.email, subject=subject, body_text=body)
                sent += 1
                logger.info(f'Business digest sent to {recipient.email}')
            except Exception as e:
                logger.error(f'Failed to send business digest to {recipient.email}: {e}', exc_info=True)
                self.stderr.write(f'  Failed to send business digest to {recipient.email}: {e}')

        self.stdout.write(f'  Business digest sent to {sent}/{recipients.count()} staff recipient(s)')
