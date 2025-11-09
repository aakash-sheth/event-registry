"""
Email backend supporting AWS SES and SendGrid
"""
import boto3
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from django.conf import settings
from apps.notifications.models import NotificationLog


def send_email(to_email, subject, body_text, body_html=None):
    """
    Send email using configured provider (SES or SendGrid)
    """
    provider = settings.EMAIL_PROVIDER.lower()
    
    try:
        if provider == 'ses':
            _send_via_ses(to_email, subject, body_text, body_html)
        elif provider == 'sendgrid':
            _send_via_sendgrid(to_email, subject, body_text, body_html)
        else:
            raise ValueError(f"Unknown email provider: {provider}")
        
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
    
    from_email = getattr(settings, 'SES_FROM_EMAIL', 'noreply@weddingregistry.com')
    
    ses_client.send_email(
        Source=from_email,
        Destination={'ToAddresses': [to_email]},
        Message=message,
    )


def _send_via_sendgrid(to_email, subject, body_text, body_html=None):
    """Send email via SendGrid"""
    if not settings.SENDGRID_API_KEY:
        raise ValueError("SENDGRID_API_KEY not configured")
    
    from_email = getattr(settings, 'SENDGRID_FROM_EMAIL', 'noreply@weddingregistry.com')
    
    message = Mail(
        from_email=from_email,
        to_emails=to_email,
        subject=subject,
        plain_text_content=body_text,
    )
    
    if body_html:
        message.html_content = body_html
    
    sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
    response = sg.send(message)
    
    if response.status_code not in [200, 201, 202]:
        raise Exception(f"SendGrid error: {response.status_code}")

