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
    """Send email via AWS SES"""
    ses_client = boto3.client(
        'ses',
        region_name=settings.SES_REGION,
        aws_access_key_id=settings.SES_ACCESS_KEY_ID,
        aws_secret_access_key=settings.SES_SECRET_ACCESS_KEY,
    )
    
    message = {
        'Subject': {'Data': subject},
        'Body': {'Text': {'Data': body_text}},
    }
    
    if body_html:
        message['Body']['Html'] = {'Data': body_html}
    
    from_email = getattr(settings, 'SES_FROM_EMAIL', 'noreply@eventregistry.com')
    
    ses_client.send_email(
        Source=from_email,
        Destination={'ToAddresses': [to_email]},
        Message=message,
    )

