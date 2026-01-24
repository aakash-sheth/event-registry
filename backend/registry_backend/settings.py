"""
Django settings for registry_backend project.
"""
import os
from pathlib import Path
from datetime import timedelta

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-change-me-in-production')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# ALLOWED_HOSTS: Include ALB DNS and allow health checks from private IPs
# ALB health checks send requests with private IP as Host header, which would fail ALLOWED_HOSTS validation
# We allow the ALB DNS name and also allow health check endpoints to work with any host
allowed_hosts_str = os.environ.get('ALLOWED_HOSTS', '*')
ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_str.split(',') if h.strip()]
# If ALLOWED_HOSTS is set to a specific value (not '*'), we still need to allow health checks
# Health check endpoints will be handled by middleware to bypass this check

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'background_task',  # For async background task processing
    'apps.users',
    'apps.events',
    'apps.items',
    'apps.orders',
    'apps.notifications',
    'apps.common',
]

# Authentication URLs - Admin login redirect
LOGIN_URL = '/api/admin/login/'
LOGIN_REDIRECT_URL = '/api/admin/'  # Redirect to admin index after successful login

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Serve static files efficiently in production
    'apps.common.middleware.HealthCheckMiddleware',  # Must be before CommonMiddleware to bypass ALLOWED_HOSTS
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'registry_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'registry_backend.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'registry'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'CONN_MAX_AGE': 600,  # Reuse database connections for 10 minutes (reduces connection overhead)
    }
}

# Parse DATABASE_URL if provided
if 'DATABASE_URL' in os.environ:
    import dj_database_url
    db_config = dj_database_url.parse(os.environ['DATABASE_URL'])
    # Force CONN_MAX_AGE to 600 (10 minutes) for connection pooling
    # dj_database_url may set it to 0, so we override it
    db_config['CONN_MAX_AGE'] = 600
    DATABASES['default'] = db_config

# Cache Configuration
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
        'OPTIONS': {
            'MAX_ENTRIES': 1000,
            'CULL_FREQUENCY': 3,
        }
    }
}

# For production, consider using Redis or Memcached:
# 'BACKEND': 'django.core.cache.backends.redis.RedisCache',
# 'LOCATION': os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/1'),

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# WhiteNoise configuration for serving static files in production
# WhiteNoise allows Django to serve static files efficiently without a separate web server
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files (user uploaded content)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    # Ensure JSON responses for API endpoints
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    # Custom exception handler to ensure JSON error responses
    'EXCEPTION_HANDLER': 'rest_framework.views.exception_handler',
}

# JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=7),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=30),
    'ROTATE_REFRESH_TOKENS': True,
}

# CORS
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:3000,http://127.0.0.1:3000'
).split(',')

CORS_ALLOW_CREDENTIALS = True

# Email Configuration
# Note: We use apps.common.email_backend.send_email() directly in views
# Email is sent via AWS SES only

# AWS SES
SES_REGION = os.environ.get('SES_REGION', 'us-east-1')
SES_ACCESS_KEY_ID = os.environ.get('SES_ACCESS_KEY_ID', '')
SES_SECRET_ACCESS_KEY = os.environ.get('SES_SECRET_ACCESS_KEY', '')
SES_FROM_EMAIL = os.environ.get('SES_FROM_EMAIL', 'no-reply@ekfern.com')

# Frontend
FRONTEND_ORIGIN = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:3000')

# Razorpay
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RAZORPAY_WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')

# OTP Settings
OTP_EXPIRY_MINUTES = 15
OTP_LENGTH = 6

# Feature Flags
WHATSAPP_ENABLED = os.environ.get('WHATSAPP_ENABLED', 'False') == 'True'

# Analytics Batch Collection Settings
# Batch processing interval in minutes
# Default: 2 minutes for development (DEBUG=True), 30 minutes for production
# For local testing, you can set ANALYTICS_BATCH_INTERVAL_MINUTES=1 for 1-minute intervals
default_interval = 2 if DEBUG else 30
ANALYTICS_BATCH_INTERVAL_MINUTES = int(os.environ.get('ANALYTICS_BATCH_INTERVAL_MINUTES', default_interval))
# Cache key prefix for pending analytics views
ANALYTICS_BATCH_CACHE_PREFIX = os.environ.get('ANALYTICS_BATCH_CACHE_PREFIX', 'analytics_pending')
# Note: For production, Redis is recommended for cache backend to handle high volume

# AWS S3 (for image uploads)
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
# Support both AWS_STORAGE_BUCKET_NAME and AWS_S3_BUCKET for compatibility
AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', '') or os.environ.get('AWS_S3_BUCKET', '')
AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-east-1')
AWS_S3_SIGNATURE_VERSION = 's3v4'

# CloudFront Image Domain (for serving images via CloudFront)
CLOUDFRONT_IMAGE_DOMAIN = os.environ.get('CLOUDFRONT_IMAGE_DOMAIN', '')

# Production Security Settings
if not DEBUG:
    # HTTPS/SSL Settings (when behind a proxy like ALB)
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = False  # Let ALB handle redirect, set to True if needed
    
    # Cookie Security
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    
    # CSRF Trusted Origins - Allow admin subdomain
    CSRF_TRUSTED_ORIGINS = [
        'https://ekfern.com',
        'https://admin.ekfern.com',
        'https://www.ekfern.com',
    ]
    
    # Security Headers
    X_FRAME_OPTIONS = 'DENY'
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    
    # HSTS (HTTP Strict Transport Security) - uncomment if using custom domain
    # SECURE_HSTS_SECONDS = 31536000  # 1 year
    # SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    # SECURE_HSTS_PRELOAD = True

# Logging Configuration
# Logs go to stdout/stderr which are captured by ECS and sent to CloudWatch
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '[{levelname}] {asctime} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'stream': 'ext://sys.stdout',  # Explicitly use stdout
        },
        'console_stderr': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
            'stream': 'ext://sys.stderr',  # Errors go to stderr
            'level': 'ERROR',
        },
    },
    'root': {
        'handlers': ['console', 'console_stderr'],
        'level': os.environ.get('LOG_LEVEL', 'INFO'),
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'console_stderr'],
            'level': os.environ.get('DJANGO_LOG_LEVEL', 'INFO'),
            'propagate': False,
        },
        'apps': {
            'handlers': ['console', 'console_stderr'],
            'level': os.environ.get('APP_LOG_LEVEL', 'DEBUG'),  # More verbose for apps
            'propagate': False,
        },
        'apps.events': {
            'handlers': ['console', 'console_stderr'],
            'level': 'DEBUG',  # Very verbose for events app during investigation
            'propagate': False,
        },
    },
}

