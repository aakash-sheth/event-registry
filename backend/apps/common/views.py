"""
Common views for the application.
"""
from django.http import JsonResponse, HttpResponse
from django.db import connection
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings


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

