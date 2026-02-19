"""
Django management command to schedule analytics batch processing
Usage: python manage.py schedule_analytics_batch
This should be run once on startup to schedule recurring batch processing
"""
from django.core.management.base import BaseCommand
from django.conf import settings
from apps.events.tasks import scheduled_batch_processing


class Command(BaseCommand):
    help = 'Schedule recurring analytics batch processing using background_task'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing scheduled tasks before scheduling new ones'
        )

    def handle(self, *args, **options):
        try:
            from background_task.models import Task
        except ImportError:
            self.stdout.write(
                self.style.ERROR('❌ background_task is not installed or not in INSTALLED_APPS')
            )
            return
        
        if options['clear']:
            # Clear existing scheduled batch processing tasks
            Task.objects.filter(task_name__contains='scheduled_batch_processing').delete()
            self.stdout.write(self.style.SUCCESS('✅ Cleared existing scheduled tasks'))
        
        # Get scheduling settings
        batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
        initial_delay_seconds = getattr(settings, 'ANALYTICS_BATCH_INITIAL_DELAY_SECONDS', 10)
        
        # Check if task is already scheduled
        existing_tasks = Task.objects.filter(
            task_name__contains='scheduled_batch_processing'
        ).count()
        
        if existing_tasks > 0 and not options['clear']:
            self.stdout.write(
                self.style.SUCCESS(
                    f'✅ Analytics batch processing already scheduled ({existing_tasks} task(s))'
                )
            )
            return
        
        # Schedule the first run shortly after startup so scheduler health is visible quickly.
        scheduled_batch_processing(schedule=initial_delay_seconds)
        
        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Scheduled analytics batch processing every {batch_interval} minutes'
            )
        )
        self.stdout.write(
            f'   First run will be in {initial_delay_seconds} seconds'
        )
        self.stdout.write(
            '   Make sure backend-worker service is running: docker-compose up backend-worker'
        )
