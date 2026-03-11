from django.urls import path
from .views import notification_preferences, unsubscribe

urlpatterns = [
    path('preferences/', notification_preferences, name='notification-preferences'),
    path('unsubscribe/<uuid:token>/', unsubscribe, name='notification-unsubscribe'),
]
