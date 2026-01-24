"""
Django management command to schedule analytics batch processing
Usage: python manage.py schedule_analytics_batch
This should be run once on startup to schedule recurring batch processing
"""
from django.core.management.base import BaseCommand
from django.conf import settings
from apps.events.tasks import process_analytics_batch


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
            from background_task import background
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
        
        # Get batch interval from settings
        batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
        schedule_seconds = batch_interval * 60
        
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
        
        # Schedule the batch processing task
        @background(schedule=schedule_seconds)
        def scheduled_batch_processing():
            """Scheduled wrapper that processes batch and reschedules itself"""
            process_analytics_batch()
            # Reschedule for next interval
            scheduled_batch_processing(schedule=schedule_seconds)
        
        # Schedule the first run
        scheduled_batch_processing(schedule=schedule_seconds)
        
        self.stdout.write(
            self.style.SUCCESS(
                f'✅ Scheduled analytics batch processing every {batch_interval} minutes'
            )
        )
        self.stdout.write(
            f'   First run will be in {batch_interval} minutes'
        )
        self.stdout.write(
            '   Make sure backend-worker service is running: docker-compose up backend-worker'
        )
