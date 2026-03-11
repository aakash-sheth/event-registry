from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import NotificationPreference
from .serializers import NotificationPreferenceSerializer


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def notification_preferences(request):
    """
    GET  — return the current user's notification preferences (auto-created on first access).
    PUT  — update the current user's notification preferences.
    """
    prefs, _ = NotificationPreference.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return Response(NotificationPreferenceSerializer(prefs).data)

    serializer = NotificationPreferenceSerializer(prefs, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def unsubscribe(request, token):
    """
    Unsubscribe endpoint embedded in email footers.
    GET  — verify the token is valid (used by the frontend page on load).
    POST — perform the unsubscribe (RFC 8058 one-click compliant).

    No authentication required — the UUID token is the credential.
    Using POST for the state-changing action prevents CSRF/image-embed attacks
    that could silently unsubscribe users via a GET request.
    """
    try:
        prefs = NotificationPreference.objects.get(unsubscribe_token=token)
    except NotificationPreference.DoesNotExist:
        return Response({'ok': False, 'message': 'Invalid unsubscribe link.'}, status=404)

    if request.method == 'GET':
        # Just validate the token — the frontend page uses this to confirm the link is alive
        # before showing the confirmation button.
        return Response({'ok': True, 'valid': True})

    # POST — perform the actual unsubscribe
    prefs.marketing_emails = False
    prefs.save(update_fields=['marketing_emails', 'updated_at'])

    return Response({
        'ok': True,
        'message': 'You have been unsubscribed from Ekfern marketing emails.',
    })
