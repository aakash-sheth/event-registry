from django.core.management.base import BaseCommand
from apps.users.models import User
import os


class Command(BaseCommand):
    help = 'Check superusers and reset password for a superuser'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Email address of the superuser to reset password for',
        )
        parser.add_argument(
            '--password',
            type=str,
            help='New password for the superuser',
        )
        parser.add_argument(
            '--list',
            action='store_true',
            help='List all superusers',
        )

    def handle(self, *args, **options):
        # List superusers if requested
        if options.get('list'):
            superusers = User.objects.filter(is_superuser=True)
            if superusers.exists():
                self.stdout.write(self.style.SUCCESS(f'\nFound {superusers.count()} superuser(s):\n'))
                for user in superusers:
                    self.stdout.write(f'  - Email: {user.email}')
                    self.stdout.write(f'    Name: {user.name or "N/A"}')
                    self.stdout.write(f'    Active: {user.is_active}')
                    self.stdout.write(f'    Staff: {user.is_staff}')
                    self.stdout.write('')
            else:
                self.stdout.write(self.style.WARNING('\nNo superusers found.\n'))
            return

        # Get values from command line arguments or environment variables
        email = options.get('email') or os.environ.get('DJANGO_SUPERUSER_EMAIL')
        password = options.get('password') or os.environ.get('DJANGO_SUPERUSER_PASSWORD')

        if not email:
            # If no email provided, try to find the first superuser
            superuser = User.objects.filter(is_superuser=True).first()
            if superuser:
                email = superuser.email
                self.stdout.write(
                    self.style.WARNING(f'No email provided. Using first superuser found: {email}')
                )
            else:
                self.stdout.write(
                    self.style.ERROR('Error: No superuser found and no email provided.')
                )
                self.stdout.write('Use --list to see all superusers or --email to specify one.')
                return

        if not password:
            self.stdout.write(
                self.style.ERROR('Error: Password is required. Set DJANGO_SUPERUSER_PASSWORD environment variable or use --password flag')
            )
            return

        # Find the superuser
        try:
            user = User.objects.get(email=email, is_superuser=True)
        except User.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(f'Error: No superuser found with email {email}')
            )
            return

        # Reset the password
        try:
            user.set_password(password)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f'Successfully reset password for superuser: {email}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error resetting password: {str(e)}')
            )


