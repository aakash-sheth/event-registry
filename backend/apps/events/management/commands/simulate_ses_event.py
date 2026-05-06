"""
Management command to simulate SES delivery events locally.

Calls _process_ses_event() directly — no HTTP, no tunnel, no AWS needed.

Usage:
    # Simulate delivery for a specific email_message_id
    python manage.py simulate_ses_event --type Delivery --message-id <id>

    # Simulate a bounce
    python manage.py simulate_ses_event --type Bounce --message-id <id>

    # Simulate a complaint
    python manage.py simulate_ses_event --type Complaint --message-id <id>

    # Look up the message ID from a campaign recipient PK
    python manage.py simulate_ses_event --type Delivery --recipient-id <pk>

    # Simulate a click for a recipient
    python manage.py simulate_ses_event --type Click --recipient-id <pk>

    # List recent campaign recipients with their message IDs
    python manage.py simulate_ses_event --list
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone


class Command(BaseCommand):
    help = 'Simulate SES delivery events locally for testing without a live SNS webhook'

    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            choices=['Delivery', 'Bounce', 'Complaint', 'Click'],
            help='SES event type to simulate',
        )
        parser.add_argument(
            '--message-id',
            help='SES email_message_id stored on CampaignRecipient',
        )
        parser.add_argument(
            '--recipient-id',
            type=int,
            help='CampaignRecipient PK — looks up the message-id automatically',
        )
        parser.add_argument(
            '--list',
            action='store_true',
            help='List recent email CampaignRecipient rows with their message IDs',
        )

    def handle(self, *args, **options):
        from apps.events.models import CampaignRecipient

        if options['list']:
            self._list_recipients()
            return

        event_type = options.get('type')
        if not event_type:
            raise CommandError('--type is required (Delivery, Bounce, Complaint, Click)')

        # Resolve message_id
        message_id = options.get('message_id')
        recipient = None

        if options.get('recipient_id'):
            try:
                recipient = CampaignRecipient.objects.select_related('campaign', 'guest').get(
                    pk=options['recipient_id']
                )
                message_id = recipient.email_message_id
                if not message_id:
                    raise CommandError(
                        f'Recipient {recipient.pk} has no email_message_id — '
                        'was this an email campaign recipient?'
                    )
            except CampaignRecipient.DoesNotExist:
                raise CommandError(f'No CampaignRecipient with pk={options["recipient_id"]}')

        if not message_id:
            raise CommandError('Provide --message-id or --recipient-id')

        if event_type == 'Click':
            self._simulate_click(message_id, recipient)
        else:
            self._simulate_ses_event(event_type, message_id)

    def _simulate_ses_event(self, event_type: str, message_id: str):
        from apps.events.views import _process_ses_event

        now_iso = timezone.now().isoformat()

        if event_type == 'Delivery':
            event_data = {
                'eventType': 'Delivery',
                'mail': {'messageId': message_id, 'timestamp': now_iso},
                'delivery': {
                    'timestamp': now_iso,
                    'recipients': ['test@example.com'],
                    'smtpResponse': '250 OK',
                },
            }

        elif event_type == 'Bounce':
            event_data = {
                'eventType': 'Bounce',
                'mail': {'messageId': message_id, 'timestamp': now_iso},
                'bounce': {
                    'bounceType': 'Permanent',
                    'bounceSubType': 'General',
                    'timestamp': now_iso,
                    'bouncedRecipients': [{'emailAddress': 'test@example.com'}],
                },
            }

        elif event_type == 'Complaint':
            event_data = {
                'eventType': 'Complaint',
                'mail': {'messageId': message_id, 'timestamp': now_iso},
                'complaint': {
                    'timestamp': now_iso,
                    'complainedRecipients': [{'emailAddress': 'test@example.com'}],
                },
            }

        self.stdout.write(f'Simulating {event_type} for message_id={message_id} ...')
        _process_ses_event(event_data)
        self._print_recipient_status(message_id)

    def _simulate_click(self, message_id: str, recipient=None):
        from apps.events.models import CampaignRecipient

        if not recipient:
            try:
                recipient = CampaignRecipient.objects.select_related('campaign').get(
                    email_message_id=message_id
                )
            except CampaignRecipient.DoesNotExist:
                raise CommandError(f'No recipient found for message_id={message_id}')

        self.stdout.write(f'Simulating Click for recipient pk={recipient.pk} ...')

        now = timezone.now()
        if recipient.status not in (
            CampaignRecipient.STATUS_READ,
            CampaignRecipient.STATUS_FAILED,
            CampaignRecipient.STATUS_SKIPPED,
        ):
            recipient.delivered_at = recipient.delivered_at or now
            recipient.status = CampaignRecipient.STATUS_READ
            recipient.read_at = now
            recipient.save(update_fields=['status', 'delivered_at', 'read_at', 'updated_at'])

            campaign = recipient.campaign
            campaign.delivered_count = CampaignRecipient.objects.filter(
                campaign=campaign,
                status__in=[CampaignRecipient.STATUS_DELIVERED, CampaignRecipient.STATUS_READ],
            ).count()
            campaign.read_count = CampaignRecipient.objects.filter(
                campaign=campaign, status=CampaignRecipient.STATUS_READ,
            ).count()
            campaign.save(update_fields=['delivered_count', 'read_count', 'updated_at'])

        self._print_recipient_status(message_id)

    def _print_recipient_status(self, message_id: str):
        from apps.events.models import CampaignRecipient

        try:
            r = CampaignRecipient.objects.select_related('campaign', 'guest').get(
                email_message_id=message_id
            )
            self.stdout.write(self.style.SUCCESS(
                f'\nRecipient pk={r.pk} | guest={r.guest} | status={r.status}'
                f'\n  delivered_at : {r.delivered_at}'
                f'\n  read_at      : {r.read_at}'
                f'\n  error        : {r.error_message or "—"}'
                f'\nCampaign "{r.campaign.name}": '
                f'sent={r.campaign.sent_count} '
                f'delivered={r.campaign.delivered_count} '
                f'read={r.campaign.read_count} '
                f'failed={r.campaign.failed_count}'
            ))
        except CampaignRecipient.DoesNotExist:
            self.stdout.write(self.style.WARNING('Could not find recipient after update'))

    def _list_recipients(self):
        from apps.events.models import CampaignRecipient

        rows = (
            CampaignRecipient.objects
            .filter(campaign__channel='email')
            .select_related('campaign', 'guest')
            .order_by('-created_at')[:20]
        )

        if not rows:
            self.stdout.write('No email campaign recipients found.')
            return

        self.stdout.write(f'\n{"PK":<6} {"Status":<12} {"Guest":<25} {"Campaign":<30} {"Message ID"}')
        self.stdout.write('-' * 110)
        for r in rows:
            guest_name = str(r.guest) if r.guest else '—'
            self.stdout.write(
                f'{r.pk:<6} {r.status:<12} {guest_name[:24]:<25} '
                f'{r.campaign.name[:29]:<30} {r.email_message_id or "—"}'
            )
