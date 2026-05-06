"""
Email backend using AWS SES.

Two entrypoints:
- send_email()              — transactional emails (existing, unchanged)
- send_campaign_email()     — bulk campaign sends with link tracking + SES MessageId capture
"""
import base64
import logging
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse

import boto3
from django.conf import settings
from apps.notifications.models import NotificationLog

logger = logging.getLogger(__name__)

# Regex that matches href="..." or href='...' in HTML bodies
_HREF_RE = re.compile(r"""href=(['"])(https?://[^'">\s]+)\1""", re.IGNORECASE)
# Regex that matches bare https?:// URLs in plain text (not already in an href)
_PLAIN_URL_RE = re.compile(r'(https?://\S+)')


def send_campaign_email(
    to_email: str,
    subject: str,
    body: str,
    *,
    is_rich_text: bool = False,
    recipient_id: int = None,
    from_name: str = '',
) -> dict:
    """
    Send a single campaign email via SES.

    Injects ek_cid=<recipient_id> into every link so click-through events can
    be correlated back to a CampaignRecipient row (Sprint 3 webhook).

    Returns: {success: bool, email_message_id: str|None, error: str|None}
    """
    try:
        tracked_body = inject_tracking_links(body, recipient_id, is_rich_text)
        msg_id = _send_campaign_via_ses(
            to_email=to_email,
            subject=subject,
            body=tracked_body,
            is_rich_text=is_rich_text,
            from_name=from_name or getattr(settings, 'SES_FROM_NAME', 'Ekfern'),
        )
        _log_notification(to_email, subject, status='sent', recipient_id=recipient_id)
        logger.info('[EmailCampaign] Sent to %s msg_id=%s', to_email, msg_id)
        return {'success': True, 'email_message_id': msg_id or '', 'error': None}

    except Exception as exc:
        err = str(exc)
        logger.warning('[EmailCampaign] Failed to send to %s: %s', to_email, err)
        _log_notification(to_email, subject, status='failed', error=err, recipient_id=recipient_id)
        return {'success': False, 'email_message_id': None, 'error': err}


def _build_tracking_url(destination: str, recipient_id: int) -> str:
    """
    Wrap a destination URL in a redirect proxy URL.
    Format: {EMAIL_TRACKING_BASE_URL}/api/events/r/?cid=<id>&u=<base64url_destination>
    Using base64url avoids double-encoding issues with nested query strings.
    """
    base = getattr(settings, 'EMAIL_TRACKING_BASE_URL', 'http://localhost:8000').rstrip('/')
    encoded = base64.urlsafe_b64encode(destination.encode()).decode()
    return f'{base}/api/events/r/?cid={recipient_id}&u={encoded}'


def inject_tracking_links(body: str, recipient_id: int | None, is_rich_text: bool) -> str:
    """
    Replace every URL in the body with a redirect proxy URL so clicks
    are recorded server-side before forwarding the user to the destination.
    """
    if not recipient_id:
        return body

    if is_rich_text:
        def _replace_href(m):
            quote, url = m.group(1), m.group(2)
            return f'href={quote}{_build_tracking_url(url, recipient_id)}{quote}'
        return _HREF_RE.sub(_replace_href, body)
    else:
        return _PLAIN_URL_RE.sub(
            lambda m: _build_tracking_url(m.group(1), recipient_id), body
        )


def get_flyer_image_url(event) -> str:
    """
    Return the CloudFront URL of the event's invite page banner/cover image.
    Checks InvitePage.config tiles for an image tile, falls back to background_url.
    Returns empty string if nothing found.
    """
    try:
        invite_page = event.invite_page
    except Exception:
        return ''

    config = invite_page.config or {}
    tiles = config.get('tiles', [])
    for tile in tiles:
        if tile.get('type') == 'image':
            url = (tile.get('settings') or {}).get('url', '')
            if url and url.startswith('http'):
                return url

    bg = getattr(invite_page, 'background_url', '') or ''
    return bg if bg.startswith('http') else ''


def _send_campaign_via_ses(
    to_email: str,
    subject: str,
    body: str,
    *,
    is_rich_text: bool,
    from_name: str,
) -> str:
    """
    Send via SES using send_raw_email so we can set custom headers.
    Returns the SES MessageId string.
    """
    ses_kwargs = {'region_name': settings.SES_REGION}
    if settings.SES_ACCESS_KEY_ID and settings.SES_SECRET_ACCESS_KEY:
        ses_kwargs['aws_access_key_id'] = settings.SES_ACCESS_KEY_ID
        ses_kwargs['aws_secret_access_key'] = settings.SES_SECRET_ACCESS_KEY

    ses_client = boto3.client('ses', **ses_kwargs)
    from_addr = getattr(settings, 'SES_FROM_EMAIL', 'no-reply@ekfern.com')
    from_header = f'{from_name} <{from_addr}>' if from_name else from_addr

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = from_header
    msg['To'] = to_email

    if is_rich_text:
        # Include a plain-text fallback stripped of tags
        plain = re.sub(r'<[^>]+>', '', body)
        msg.attach(MIMEText(plain, 'plain', 'utf-8'))
        msg.attach(MIMEText(body, 'html', 'utf-8'))
    else:
        msg.attach(MIMEText(body, 'plain', 'utf-8'))

    send_kwargs = {
        'Source': from_header,
        'Destinations': [to_email],
        'RawMessage': {'Data': msg.as_bytes()},
    }

    config_set = getattr(settings, 'SES_CAMPAIGN_CONFIG_SET', '')
    if config_set:
        send_kwargs['ConfigurationSetName'] = config_set

    response = ses_client.send_raw_email(**send_kwargs)
    return response.get('MessageId', '')


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


def _log_notification(to_email, subject, status, error='', recipient_id=None):
    """Write to NotificationLog without raising — logging failures must never affect email delivery."""
    try:
        payload = {'subject': subject}
        if recipient_id is not None:
            payload['campaign_recipient_id'] = recipient_id
        NotificationLog.objects.create(
            channel='email',
            to=to_email,
            template='custom',
            payload_json=payload,
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
