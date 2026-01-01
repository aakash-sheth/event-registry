"""
Common views for the application.
"""
from django.http import JsonResponse, HttpResponse
from django.db import connection
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import json
from .cloudwatch_logger import log_to_cloudwatch


@csrf_exempt  # Safe for GET/HEAD - CSRF doesn't apply to read-only requests
@require_http_methods(["GET", "HEAD"])
def health_check(request):
    """
    Health check endpoint for load balancer and monitoring.
    Returns 200 if the service is healthy, 503 if database is unavailable.
    Compatible with ALB health checks (no DRF decorators).
    
    Security: This endpoint is intentionally public for ALB health checks.
    It only returns service status and does not expose sensitive information.
    """
    # For HEAD requests, return empty body (ALB may use HEAD)
    if request.method == "HEAD":
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return HttpResponse(status=200)
        except Exception:
            return HttpResponse(status=503)
    
    # For GET requests, return JSON response
    try:
        # Check database connectivity
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"status": "ok", "database": "connected"}, status=200)
    except Exception as e:
        # Don't expose error details in production for security
        error_msg = str(e) if settings.DEBUG else "Database unavailable"
        return JsonResponse({"status": "unhealthy", "database": "disconnected", "error": error_msg}, status=503)


@api_view(['POST'])
@permission_classes([AllowAny])  # Allow frontend to send logs
@csrf_exempt
def log_to_cloudwatch_endpoint(request):
    """
    Endpoint to receive logs from frontend and forward to CloudWatch
    This allows frontend to send debug/error logs to CloudWatch via backend
    
    Note: This endpoint always returns 200 OK, even if CloudWatch logging fails.
    Logging failures should not break the application. Errors are logged internally.
    """
    try:
        data = request.data
        message = data.get('message', '')
        level = data.get('level', 'INFO')
        extra_data = data.get('data', {})
        
        # Add frontend context
        extra_data['source'] = 'frontend'
        extra_data['user_agent'] = request.META.get('HTTP_USER_AGENT', '')
        extra_data['path'] = request.META.get('PATH_INFO', '')
        
        # Send to CloudWatch (failures are handled internally by log_to_cloudwatch)
        # The function has fallback to Python logging if CloudWatch fails
        log_to_cloudwatch(
            message=message,
            level=level,
            log_group='/ecs/event-registry-staging/frontend',
            log_stream='application',
            extra_data=extra_data
        )
        
        return JsonResponse({'status': 'ok'}, status=status.HTTP_200_OK)
    except Exception as e:
        # Logging failures should not break the app - return 200 anyway
        # The error is already logged by log_to_cloudwatch's fallback mechanism
        # or will be logged here if log_to_cloudwatch itself fails
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f'CloudWatch logging endpoint error (non-critical): {str(e)}')
        # Always return 200 - logging is non-critical
        return JsonResponse({'status': 'ok', 'note': 'logging may have failed'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_analytics(request):
    """
    Admin-only analytics endpoint
    Returns comprehensive business metrics for founders
    
    Requires:
    - JWT authentication
    - User must be superuser (is_superuser=True)
    
    Returns:
    - JSON response with metrics across 6 categories:
      - users: host statistics
      - events: event statistics
      - engagement: RSVP and guest statistics
      - business: order and revenue statistics
      - geographic: location-based statistics
      - growth: daily trends for last 30 days
    """
    # Check if user is superuser
    if not request.user.is_superuser:
        return Response(
            {'error': 'Unauthorized. Admin access required.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Import models
    from apps.users.models import User
    from apps.events.models import Event, RSVP, Guest
    from apps.orders.models import Order
    from apps.items.models import RegistryItem
    from django.db.models import Count, Sum, Avg, Q, F
    from datetime import timedelta
    from django.utils import timezone
    
    today = timezone.now().date()
    last_7_days = today - timedelta(days=7)
    last_30_days = today - timedelta(days=30)
    
    # User Metrics
    users = {
        'total': User.objects.count(),
        'new_last_7_days': User.objects.filter(created_at__date__gte=last_7_days).count(),
        'new_last_30_days': User.objects.filter(created_at__date__gte=last_30_days).count(),
        'verified': User.objects.filter(email_verified=True).count(),
        'with_events': User.objects.filter(events__isnull=False).distinct().count(),
    }
    
    # Event Metrics
    # Active events: not expired (expiry_date >= today OR (expiry_date is null AND date >= today) OR both null)
    active_events = Event.objects.filter(
        Q(expiry_date__gte=today) | 
        Q(expiry_date__isnull=True, date__gte=today) |
        Q(expiry_date__isnull=True, date__isnull=True)
    )
    
    # Expired events: expiry_date < today OR (expiry_date is null AND date < today)
    expired_events = Event.objects.filter(
        Q(expiry_date__lt=today) |
        Q(expiry_date__isnull=True, date__lt=today)
    )
    
    # Extended events: expiry_date exists and was updated after creation
    extended_events = Event.objects.exclude(expiry_date__isnull=True).filter(
        updated_at__gt=F('created_at')
    )
    
    events = {
        'total': Event.objects.count(),
        'active': active_events.count(),
        'expired': expired_events.count(),
        'created_last_7_days': Event.objects.filter(created_at__date__gte=last_7_days).count(),
        'created_last_30_days': Event.objects.filter(created_at__date__gte=last_30_days).count(),
        'by_type': list(Event.objects.values('event_type').annotate(count=Count('id'))),
        'public': Event.objects.filter(is_public=True).count(),
        'private': Event.objects.filter(is_public=False).count(),
        'with_rsvp': Event.objects.filter(has_rsvp=True).count(),
        'with_registry': Event.objects.filter(has_registry=True).count(),
        'extended': extended_events.count(),
    }
    
    # Engagement Metrics
    rsvps_yes = RSVP.objects.filter(will_attend='yes', is_removed=False)
    total_guests_attending = rsvps_yes.aggregate(Sum('guests_count'))['guests_count__sum'] or 0
    
    engagement = {
        'total_rsvps': RSVP.objects.filter(is_removed=False).count(),
        'rsvps_yes': rsvps_yes.count(),
        'rsvps_no': RSVP.objects.filter(will_attend='no', is_removed=False).count(),
        'rsvps_maybe': RSVP.objects.filter(will_attend='maybe', is_removed=False).count(),
        'total_guests_invited': Guest.objects.filter(is_removed=False).count(),
        'total_guests_attending': total_guests_attending,
        'active_registries': Event.objects.filter(items__isnull=False).distinct().count(),
        'total_items': RegistryItem.objects.count(),
        'items_purchased': RegistryItem.objects.aggregate(
            total_purchased=Sum('qty_purchased')
        )['total_purchased'] or 0,
        'items_available': RegistryItem.objects.aggregate(
            total_available=Sum(F('qty_total') - F('qty_purchased'))
        )['total_available'] or 0,
    }
    
    # Business Metrics
    paid_orders = Order.objects.filter(status='paid')
    total_revenue_paise = paid_orders.aggregate(Sum('amount_inr'))['amount_inr__sum'] or 0
    
    business = {
        'total_orders': Order.objects.count(),
        'paid_orders': paid_orders.count(),
        'total_revenue_paise': total_revenue_paise,
        'total_revenue_rupees': total_revenue_paise / 100,
        'avg_order_value_paise': paid_orders.aggregate(Avg('amount_inr'))['amount_inr__avg'] or 0,
        'avg_order_value_rupees': (paid_orders.aggregate(Avg('amount_inr'))['amount_inr__avg'] or 0) / 100,
        'orders_last_7_days': Order.objects.filter(created_at__date__gte=last_7_days).count(),
        'orders_last_30_days': Order.objects.filter(created_at__date__gte=last_30_days).count(),
        'events_with_orders': Event.objects.filter(orders__isnull=False).distinct().count(),
        'revenue_by_event_type': list(
            Order.objects.filter(status='paid')
            .values('event__event_type')
            .annotate(revenue=Sum('amount_inr'))
        ),
    }
    
    # Geographic Metrics
    geographic = {
        'events_by_country': list(
            Event.objects.values('country')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        ),
        'top_cities': list(
            Event.objects.exclude(city='')
            .values('city')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        ),
    }
    
    # Growth Trends - Daily data for last 30 days
    growth = {
        'hosts_daily': [
            {
                'date': (today - timedelta(days=i)).isoformat(),
                'count': User.objects.filter(
                    created_at__date=(today - timedelta(days=i))
                ).count()
            }
            for i in range(30, -1, -1)
        ],
        'events_daily': [
            {
                'date': (today - timedelta(days=i)).isoformat(),
                'count': Event.objects.filter(
                    created_at__date=(today - timedelta(days=i))
                ).count()
            }
            for i in range(30, -1, -1)
        ],
        'orders_daily': [
            {
                'date': (today - timedelta(days=i)).isoformat(),
                'count': Order.objects.filter(
                    created_at__date=(today - timedelta(days=i))
                ).count()
            }
            for i in range(30, -1, -1)
        ],
    }
    
    return Response({
        'users': users,
        'events': events,
        'engagement': engagement,
        'business': business,
        'geographic': geographic,
        'growth': growth,
        'generated_at': timezone.now().isoformat(),
    }, status=status.HTTP_200_OK)