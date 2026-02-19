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
                from background_task.models import Task
                from apps.events.tasks import scheduled_batch_processing
                
                # Check if already scheduled
                existing = Task.objects.filter(
                    task_name__contains='scheduled_batch_processing'
                ).exists()
                
                if not existing:
                    batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
                    initial_delay_seconds = getattr(settings, 'ANALYTICS_BATCH_INITIAL_DELAY_SECONDS', 10)
                    
                    # Schedule first run quickly so scheduler liveness is easy to verify.
                    scheduled_batch_processing(schedule=initial_delay_seconds)
                    logger.info(
                        f"Scheduled analytics batch processing every {batch_interval} minutes "
                        f"(first run in {initial_delay_seconds}s)"
                    )
                else:
                    logger.debug("Analytics batch processing already scheduled")
                    
            except ImportError:
                logger.warning("background_task not available, skipping auto-scheduling")
            except Exception as e:
                logger.error(f"Failed to auto-schedule analytics batch processing: {str(e)}")
        else:
            logger.debug("Auto-scheduling disabled. Run 'python manage.py schedule_analytics_batch' manually.")

