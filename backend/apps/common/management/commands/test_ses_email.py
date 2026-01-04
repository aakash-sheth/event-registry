"""
Management command to test AWS SES email sending configuration
"""
from django.core.management.base import BaseCommand
from django.conf import settings
from apps.common.email_backend import send_email
from apps.notifications.models import NotificationLog
from datetime import datetime, timedelta
import boto3


class Command(BaseCommand):
    help = 'Test AWS SES email sending configuration'

    def add_arguments(self, parser):
        parser.add_argument(
            '--to',
            type=str,
            help='Recipient email address (required unless using --check-config or --check-logs)',
        )
        parser.add_argument(
            '--from',
            type=str,
            dest='from_email',
            help='Override FROM email address (defaults to SES_FROM_EMAIL setting)',
        )
        parser.add_argument(
            '--check-config',
            action='store_true',
            help='Only display configuration without sending email',
        )
        parser.add_argument(
            '--check-logs',
            action='store_true',
            help='Show recent email logs from NotificationLog',
        )

    def handle(self, *args, **options):
        # Display configuration
        self.display_configuration()
        
        # Check logs if requested
        if options.get('check_logs'):
            self.check_recent_logs()
            return
        
        # Validate configuration
        if not self.validate_configuration():
            return
        
        # If only checking config, exit here
        if options.get('check_config'):
            self.stdout.write(self.style.SUCCESS('\n✅ Configuration check complete.'))
            return
        
        # Send test email
        to_email = options.get('to')
        if not to_email:
            self.stdout.write(
                self.style.ERROR('\n❌ Error: --to email address is required (unless using --check-config or --check-logs)')
            )
            return
        
        from_email = options.get('from_email') or settings.SES_FROM_EMAIL
        
        self.send_test_email(to_email, from_email)
        
        # Check results in NotificationLog
        self.check_test_result(to_email)

    def display_configuration(self):
        """Display current SES configuration"""
        self.stdout.write(self.style.SUCCESS('\n📧 AWS SES Configuration\n'))
        
        # Region
        region = getattr(settings, 'SES_REGION', 'us-east-1')
        self.stdout.write(f'  Region: {region}')
        
        # FROM email
        from_email = getattr(settings, 'SES_FROM_EMAIL', 'no-reply@ekfern.com')
        self.stdout.write(f'  FROM Email: {from_email}')
        
        # Authentication method
        has_explicit_creds = bool(
            getattr(settings, 'SES_ACCESS_KEY_ID', '') and 
            getattr(settings, 'SES_SECRET_ACCESS_KEY', '')
        )
        
        if has_explicit_creds:
            self.stdout.write(self.style.WARNING('  Authentication: Explicit credentials (IAM role recommended for ECS)'))
        else:
            self.stdout.write(self.style.SUCCESS('  Authentication: IAM role (recommended)'))
        
        # DEBUG mode
        debug_mode = getattr(settings, 'DEBUG', False)
        if debug_mode:
            self.stdout.write(self.style.WARNING(f'  DEBUG Mode: {debug_mode} (OTP may be returned in API responses)'))
        else:
            self.stdout.write(self.style.SUCCESS(f'  DEBUG Mode: {debug_mode} (Production mode)'))
        
        self.stdout.write('')

    def validate_configuration(self):
        """Validate SES configuration"""
        errors = []
        warnings = []
        
        # Check region
        region = getattr(settings, 'SES_REGION', None)
        if not region:
            errors.append('SES_REGION is not set')
        
        # Check FROM email
        from_email = getattr(settings, 'SES_FROM_EMAIL', None)
        if not from_email:
            errors.append('SES_FROM_EMAIL is not set')
        
        # Check authentication
        has_explicit_creds = bool(
            getattr(settings, 'SES_ACCESS_KEY_ID', '') and 
            getattr(settings, 'SES_SECRET_ACCESS_KEY', '')
        )
        if has_explicit_creds:
            warnings.append('Using explicit credentials. IAM role is recommended for ECS deployments.')
        
        # Display errors
        if errors:
            self.stdout.write(self.style.ERROR('\n❌ Configuration Errors:'))
            for error in errors:
                self.stdout.write(self.style.ERROR(f'  - {error}'))
            return False
        
        # Display warnings
        if warnings:
            self.stdout.write(self.style.WARNING('\n⚠️  Configuration Warnings:'))
            for warning in warnings:
                self.stdout.write(self.style.WARNING(f'  - {warning}'))
        
        return True

    def send_test_email(self, to_email, from_email):
        """Send a test email via SES"""
        self.stdout.write(f'\n📤 Sending test email...')
        self.stdout.write(f'   To: {to_email}')
        self.stdout.write(f'   From: {from_email}')
        self.stdout.write('')
        
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')
        subject = 'SES Production Test - Event Registry'
        body_text = f"""This is a test email from Event Registry to verify AWS SES production access is working correctly.

Test Details:
- Timestamp: {timestamp}
- Recipient: {to_email}
- Sender: {from_email}

If you receive this email, SES is configured properly and ready for production use!

This is an automated test message. You can safely ignore it.
"""
        
        try:
            # Temporarily override FROM email if provided
            original_from = settings.SES_FROM_EMAIL
            if from_email != original_from:
                settings.SES_FROM_EMAIL = from_email
            
            send_email(
                to_email=to_email,
                subject=subject,
                body_text=body_text,
            )
            
            # Restore original FROM email
            if from_email != original_from:
                settings.SES_FROM_EMAIL = original_from
            
            self.stdout.write(self.style.SUCCESS('✅ Email sent successfully!'))
            self.stdout.write('   Check the recipient inbox to confirm delivery.')
            
        except Exception as e:
            error_str = str(e)
            self.stdout.write(self.style.ERROR(f'❌ Failed to send email: {error_str}'))
            
            # Provide specific error guidance
            self.handle_ses_error(error_str)
            
            # Restore original FROM email if it was changed
            if from_email != original_from:
                settings.SES_FROM_EMAIL = original_from

    def handle_ses_error(self, error_str):
        """Handle SES-specific errors and provide guidance"""
        self.stdout.write('\n🔍 Error Analysis:')
        
        # Sandbox mode errors
        if 'MessageRejected' in error_str or 'Email address is not verified' in error_str:
            self.stdout.write(self.style.WARNING('  ⚠️  SES Sandbox Mode Detected'))
            self.stdout.write('     In sandbox mode, both FROM and recipient emails must be verified.')
            self.stdout.write('     Solution: Request production access in AWS SES console.')
        
        # Authentication errors
        elif 'InvalidClientTokenId' in error_str or 'SignatureDoesNotMatch' in error_str:
            self.stdout.write(self.style.ERROR('  ❌ Authentication Error'))
            self.stdout.write('     Check IAM role permissions or explicit credentials.')
            self.stdout.write('     Required permission: ses:SendEmail')
        
        # FROM email not verified
        elif 'MailFromDomainNotVerified' in error_str or 'DomainNotVerified' in error_str:
            self.stdout.write(self.style.WARNING('  ⚠️  FROM Email/Domain Not Verified'))
            self.stdout.write('     Verify the FROM email or domain in AWS SES console.')
        
        # Rate limiting
        elif 'SendingPaused' in error_str or 'Throttling' in error_str:
            self.stdout.write(self.style.WARNING('  ⚠️  Rate Limiting'))
            self.stdout.write('     SES sending is paused or rate limited.')
            self.stdout.write('     Check AWS SES console for account status.')
        
        # Generic error
        else:
            self.stdout.write(self.style.ERROR('  ❌ Unknown Error'))
            self.stdout.write('     Check AWS SES console and CloudWatch logs for details.')

    def check_test_result(self, to_email):
        """Check NotificationLog for the test email result"""
        self.stdout.write('\n📋 Checking NotificationLog...')
        
        # Get the most recent email log for this recipient (within last 5 minutes)
        recent_time = datetime.now() - timedelta(minutes=5)
        recent_logs = NotificationLog.objects.filter(
            channel='email',
            to=to_email,
            created_at__gte=recent_time
        ).order_by('-created_at')[:1]
        
        if recent_logs.exists():
            log = recent_logs.first()
            self.stdout.write(f'   Status: {log.status}')
            self.stdout.write(f'   Created: {log.created_at}')
            
            if log.status == 'sent':
                self.stdout.write(self.style.SUCCESS('   ✅ Email was logged as sent'))
            elif log.status == 'failed':
                self.stdout.write(self.style.ERROR('   ❌ Email was logged as failed'))
                if log.last_error:
                    self.stdout.write(f'   Error: {log.last_error}')
        else:
            self.stdout.write(self.style.WARNING('   ⚠️  No recent log entry found (may take a moment to appear)'))

    def check_recent_logs(self, limit=10):
        """Display recent email logs from NotificationLog"""
        self.stdout.write(self.style.SUCCESS(f'\n📋 Recent Email Logs (last {limit}):\n'))
        
        recent_logs = NotificationLog.objects.filter(
            channel='email'
        ).order_by('-created_at')[:limit]
        
        if recent_logs.exists():
            for log in recent_logs:
                status_style = self.style.SUCCESS if log.status == 'sent' else self.style.ERROR
                self.stdout.write(f'  {status_style(log.status.upper())} | {log.to} | {log.created_at}')
                if log.status == 'failed' and log.last_error:
                    self.stdout.write(f'    Error: {log.last_error}')
                self.stdout.write('')
        else:
            self.stdout.write(self.style.WARNING('  No email logs found.'))

