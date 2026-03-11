from django.apps import AppConfig


class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notifications'

    def ready(self):
        # Import models module so the post_save signal receiver is registered.
        # Without this, the signal is never connected and NotificationPreference
        # is never auto-created for new users.
        import apps.notifications.models  # noqa: F401
