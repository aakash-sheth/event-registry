"""
Django management command to check email sending status for a specific email
"""
from django.core.management.base import BaseCommand
from apps.notifications.models import NotificationLog
from apps.users.models import User
from datetime import datetime, timedelta


class Command(BaseCommand):
    help = 'Check email sending status for a specific email address'

    def add_arguments(self, parser):
        parser.add_argument(
            'email',
            type=str,
            help='Email address to check',
        )
        parser.add_argument(
            '--hours',
            type=int,
            default=24,
            help='Number of hours to look back (default: 24)',
        )

    def handle(self, *args, **options):
        email = options['email']
        hours = options['hours']
        recent_time = datetime.now() - timedelta(hours=hours)

        self.stdout.write(f'\n🔍 Email Status Check for: {email}')
        self.stdout.write('=' * 60)
        
        # Check if user exists
        self.stdout.write('\n1️⃣ User Account Status:')
        try:
            user = User.objects.get(email=email)
            self.stdout.write(self.style.SUCCESS(f'   ✅ User exists'))
            self.stdout.write(f'   Name: {user.name or "N/A"}')
            self.stdout.write(f'   Created: {user.created_at}')
            self.stdout.write(f'   Active: {user.is_active}')
            self.stdout.write(f'   Has OTP: {"Yes" if user.otp_code else "No"}')
            if user.otp_code:
                self.stdout.write(f'   OTP Expires: {user.otp_expires_at}')
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'   ❌ User does NOT exist'))
            self.stdout.write('   This email is not registered in the system.')
            return

        # Check NotificationLog
        self.stdout.write(f'\n2️⃣ Email Sending History (last {hours} hours):')
        self.stdout.write('-' * 60)
        
        logs = NotificationLog.objects.filter(
            channel='email',
            to=email,
            created_at__gte=recent_time
        ).order_by('-created_at')

        if logs.exists():
            for log in logs:
                status_icon = "✅" if log.status == 'sent' else "❌"
                status_color = self.style.SUCCESS if log.status == 'sent' else self.style.ERROR
                self.stdout.write(f'\n{status_icon} {status_color(log.status.upper())} - {log.created_at}')
                self.stdout.write(f'   Subject: {log.payload_json.get("subject", "N/A")}')
                if log.status == 'failed':
                    self.stdout.write(self.style.ERROR(f'   Error: {log.last_error}'))
        else:
            self.stdout.write(self.style.WARNING(f'   ⚠️  No email logs found for this address in the last {hours} hours'))
            self.stdout.write('   This could mean:')
            self.stdout.write('      • Email was never attempted')
            self.stdout.write('      • Logs are older than the time window')
            self.stdout.write('      • Email sending failed before logging')

        # Check all recent email attempts (for context)
        self.stdout.write(f'\n3️⃣ Recent Email Activity (all addresses, last 10):')
        self.stdout.write('-' * 60)
        
        all_logs = NotificationLog.objects.filter(
            channel='email'
        ).order_by('-created_at')[:10]

        if all_logs.exists():
            for log in all_logs:
                status_icon = "✅" if log.status == 'sent' else "❌"
                status_color = self.style.SUCCESS if log.status == 'sent' else self.style.ERROR
                self.stdout.write(f'{status_icon} {log.to} - {status_color(log.status)} - {log.created_at}')
                if log.status == 'failed' and log.last_error:
                    error_preview = log.last_error[:80] + '...' if len(log.last_error) > 80 else log.last_error
                    self.stdout.write(f'   Error: {error_preview}')
        else:
            self.stdout.write(self.style.WARNING('   No email logs found at all'))

        # Summary
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write('📝 Summary:')
        
        if logs.exists():
            latest_log = logs.first()
            if latest_log.status == 'sent':
                self.stdout.write(self.style.SUCCESS('   ✅ Latest email attempt was successful'))
                self.stdout.write('   → Check spam folder if email not received')
            else:
                self.stdout.write(self.style.ERROR('   ❌ Latest email attempt FAILED'))
                self.stdout.write(f'   → Error: {latest_log.last_error}')
                self.stdout.write('\n   Common causes:')
                self.stdout.write('      • SES sandbox mode (recipient not verified)')
                self.stdout.write('      • FROM email not verified in SES')
                self.stdout.write('      • IAM permissions issue')
                self.stdout.write('      • SES region misconfiguration')
        else:
            self.stdout.write(self.style.WARNING('   ⚠️  No email attempts found in logs'))
            self.stdout.write('   → Email sending may have failed before logging')
            self.stdout.write('   → Check CloudWatch logs for "Failed to send OTP email"')

        self.stdout.write('')
