"""
Email backend using AWS SES
"""
import boto3
from django.conf import settings
from apps.notifications.models import NotificationLog


def send_email(to_email, subject, body_text, body_html=None):
    """
    Send email using AWS SES
    """
    try:
        _send_via_ses(to_email, subject, body_text, body_html)
        
        # Log success
        NotificationLog.objects.create(
            channel='email',
            to=to_email,
            template='custom',
            payload_json={'subject': subject},
            status='sent',
        )
        
    except Exception as e:
        # Log failure
        NotificationLog.objects.create(
            channel='email',
            to=to_email,
            template='custom',
            payload_json={'subject': subject},
            status='failed',
            last_error=str(e),
        )
        raise


def _send_via_ses(to_email, subject, body_text, body_html=None):
    """Send email via AWS SES using IAM role credentials"""
    # Use IAM role credentials if explicit keys are not provided
    # The ECS task role has SES permissions, so we can use IAM role authentication
    ses_kwargs = {
        'region_name': settings.SES_REGION,
    }
    
    # Only use explicit credentials if both are provided
    # Otherwise, use IAM role (recommended for ECS)
    if settings.SES_ACCESS_KEY_ID and settings.SES_SECRET_ACCESS_KEY:
        ses_kwargs['aws_access_key_id'] = settings.SES_ACCESS_KEY_ID
        ses_kwargs['aws_secret_access_key'] = settings.SES_SECRET_ACCESS_KEY
    
    ses_client = boto3.client('ses', **ses_kwargs)
    
    message = {
        'Subject': {'Data': subject},
        'Body': {'Text': {'Data': body_text}},
    }
    
    if body_html:
        message['Body']['Html'] = {'Data': body_html}
    
    from_email = getattr(settings, 'SES_FROM_EMAIL', 'no-reply@ekfern.com')
    
    ses_client.send_email(
        Source=from_email,
        Destination={'ToAddresses': [to_email]},
        Message=message,
    )

