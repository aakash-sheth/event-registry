"""
Email backend using AWS SES
"""
import logging

import boto3
from django.conf import settings
from apps.notifications.models import NotificationLog

logger = logging.getLogger(__name__)


def send_email(to_email, subject, body_text, body_html=None, unsubscribe_token=None):
    """
    Send email using AWS SES.

    If unsubscribe_token is provided, an unsubscribe footer is appended to the
    plain-text body (required for Gmail/Yahoo bulk sender compliance).

    NotificationLog write failures are caught and logged independently so a DB
    hiccup never prevents an email from being delivered (or surfaces as a false
    send-failure to callers).
    """
    if unsubscribe_token:
        body_text = _append_unsubscribe_footer(body_text, unsubscribe_token)

    try:
        _send_via_ses(to_email, subject, body_text, body_html)
        _log_notification(to_email, subject, status='sent')
    except Exception as e:
        _log_notification(to_email, subject, status='failed', error=str(e))
        raise


def _log_notification(to_email, subject, status, error=''):
    """Write to NotificationLog without raising — logging failures must never affect email delivery."""
    try:
        NotificationLog.objects.create(
            channel='email',
            to=to_email,
            template='custom',
            payload_json={'subject': subject},
            status=status,
            last_error=error,
        )
    except Exception as log_err:
        logger.error(f'Failed to write NotificationLog for {to_email}: {log_err}')


def _append_unsubscribe_footer(body_text: str, unsubscribe_token) -> str:
    """Append a plain-text unsubscribe footer to an email body."""
    frontend = getattr(settings, 'FRONTEND_ORIGIN', 'https://ekfern.com')
    url = f"{frontend}/unsubscribe/{unsubscribe_token}"
    return (
        body_text
        + f"\n\n---\nManage notification settings: {frontend}/host/profile\n"
        + f"Unsubscribe from marketing emails: {url}"
    )


def _send_via_ses(to_email, subject, body_text, body_html=None):
    """Send email via AWS SES using IAM role credentials."""
    ses_kwargs = {'region_name': settings.SES_REGION}

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
        # Note: SES send_email does not support arbitrary headers like List-Unsubscribe.
        # The unsubscribe URL is included in the plain-text footer (appended above).
        # For full RFC 8058 List-Unsubscribe-Post header support, migrate to send_raw_email.
    )
