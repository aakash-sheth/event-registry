"""
Management command to send a test email via SES.

Usage:
    python manage.py send_test_email --to you@example.com
    python manage.py send_test_email --to you@example.com --html
"""
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Send a test email via SES to verify credentials and sandbox settings'

    def add_arguments(self, parser):
        parser.add_argument('--to', required=True, help='Recipient email address')
        parser.add_argument('--html', action='store_true', help='Send as HTML (rich text)')

    def handle(self, *args, **options):
        from apps.common.email_backend import send_campaign_email

        to_email = options['to']
        is_html = options['html']

        subject = 'Ekfern SES test email'
        if is_html:
            body = (
                '<h2>Hello from Ekfern!</h2>'
                '<p>This is a <strong>test HTML email</strong> sent via AWS SES.</p>'
                '<p>Click tracking: <a href="https://ekfern.com">visit ekfern.com</a></p>'
            )
        else:
            body = (
                'Hello from Ekfern!\n\n'
                'This is a test plain-text email sent via AWS SES.\n'
                'If you received this, your SES credentials are working correctly.\n\n'
                '— Ekfern system'
            )

        self.stdout.write(f'Sending test email to {to_email} (html={is_html})...')

        result = send_campaign_email(
            to_email=to_email,
            subject=subject,
            body=body,
            is_rich_text=is_html,
            recipient_id=None,
        )

        if result['success']:
            self.stdout.write(self.style.SUCCESS(
                f'\nSent successfully!\n'
                f'  SES MessageId : {result["email_message_id"]}\n'
                f'\nCheck {to_email} inbox (and spam folder).'
            ))
        else:
            raise CommandError(f'Send failed: {result["error"]}')
