from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class EventsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.events'
    
    def ready(self):
        """Auto-schedule analytics batch processing on app startup"""
        # Only schedule in production or when explicitly enabled
        # In development, you can manually run: python manage.py schedule_analytics_batch
        import os
        from django.conf import settings
        
        # Check if auto-scheduling is enabled (default: True in production, False in development)
        auto_schedule = os.environ.get('AUTO_SCHEDULE_ANALYTICS_BATCH', 'False') == 'True'
        
        if auto_schedule:
            try:
                from background_task import background
                from background_task.models import Task
                from apps.events.tasks import process_analytics_batch
                
                # Check if already scheduled
                existing = Task.objects.filter(
                    task_name__contains='scheduled_batch_processing'
                ).exists()
                
                if not existing:
                    batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
                    schedule_seconds = batch_interval * 60
                    
                    @background(schedule=schedule_seconds)
                    def scheduled_batch_processing():
                        """Scheduled wrapper that processes batch and reschedules itself"""
                        process_analytics_batch()
                        # Reschedule for next interval
                        scheduled_batch_processing(schedule=schedule_seconds)
                    
                    # Schedule the first run
                    scheduled_batch_processing(schedule=schedule_seconds)
                    logger.info(f"Scheduled analytics batch processing every {batch_interval} minutes")
                else:
                    logger.debug("Analytics batch processing already scheduled")
                    
            except ImportError:
                logger.warning("background_task not available, skipping auto-scheduling")
            except Exception as e:
                logger.error(f"Failed to auto-schedule analytics batch processing: {str(e)}")
        else:
            logger.debug("Auto-scheduling disabled. Run 'python manage.py schedule_analytics_batch' manually.")

