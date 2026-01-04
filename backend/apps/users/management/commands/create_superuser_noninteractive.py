from django.core.management.base import BaseCommand
from apps.users.models import User
import os


class Command(BaseCommand):
    help = 'Create a superuser non-interactively using environment variables'

    def add_arguments(self, parser):
        parser.add_argument(
            '--email',
            type=str,
            help='Email address for the superuser',
        )
        parser.add_argument(
            '--password',
            type=str,
            help='Password for the superuser',
        )
        parser.add_argument(
            '--name',
            type=str,
            default='',
            help='Name for the superuser (optional)',
        )

    def handle(self, *args, **options):
        # Get values from command line arguments or environment variables
        email = options.get('email') or os.environ.get('DJANGO_SUPERUSER_EMAIL')
        password = options.get('password') or os.environ.get('DJANGO_SUPERUSER_PASSWORD')
        name = options.get('name') or os.environ.get('DJANGO_SUPERUSER_NAME', '')

        if not email:
            self.stdout.write(
                self.style.ERROR('Error: Email is required. Set DJANGO_SUPERUSER_EMAIL environment variable or use --email flag')
            )
            return

        if not password:
            self.stdout.write(
                self.style.ERROR('Error: Password is required. Set DJANGO_SUPERUSER_PASSWORD environment variable or use --password flag')
            )
            return

        # Check if user already exists
        if User.objects.filter(email=email).exists():
            self.stdout.write(
                self.style.WARNING(f'User with email {email} already exists. Skipping creation.')
            )
            return

        # Create the superuser
        try:
            User.objects.create_superuser(email=email, name=name, password=password)
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created superuser: {email}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error creating superuser: {str(e)}')
            )


