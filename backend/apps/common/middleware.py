"""
Custom middleware for the application.
"""
from django.http import HttpResponse
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings


class HealthCheckMiddleware(MiddlewareMixin):
    """
    Middleware to bypass ALLOWED_HOSTS validation for health check endpoints.
    
    ALB health checks send requests with private IP addresses as the Host header
    (e.g., 10.0.4.50), which don't match ALLOWED_HOSTS (e.g., ALB DNS name).
    This causes Django's CommonMiddleware to return HTTP 400 (DisallowedHost exception).
    
    This middleware modifies the Host header for health check requests BEFORE
    CommonMiddleware validates ALLOWED_HOSTS, allowing health checks to pass.
    
    This must be placed BEFORE CommonMiddleware in MIDDLEWARE list.
    """
    
    def process_request(self, request):
        # Allow health check endpoints to work with any Host header
        if request.path in ['/health', '/api/health']:
            # Modify HTTP_HOST to match an allowed host before CommonMiddleware validates it
            if hasattr(request, 'META'):
                # Store original host for potential logging
                original_host = request.META.get('HTTP_HOST', '')
                request.META['_original_host'] = original_host
                
                # Set a valid host that will pass ALLOWED_HOSTS validation
                if settings.ALLOWED_HOSTS:
                    # Use the first allowed host (usually ALB DNS name)
                    allowed_host = settings.ALLOWED_HOSTS[0]
                    if allowed_host != '*':
                        request.META['HTTP_HOST'] = allowed_host
                else:
                    # If no ALLOWED_HOSTS set, use a safe default
                    request.META['HTTP_HOST'] = 'localhost'
        return None

