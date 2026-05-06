"""
Campaign dispatch background tasks using django-background-tasks.

Run the task worker process:
    python manage.py process_tasks

For scheduling, run with:
    python manage.py process_tasks --duration=3600
"""
import logging
import re
import time
from background_task import background
from django.conf import settings
from django.utils import timezone

# E.164-ish: must start with + followed by 9–15 digits
_PHONE_RE = re.compile(r'^\+\d{9,15}$')

logger = logging.getLogger(__name__)


@background(schedule=0)
def dispatch_campaign(campaign_id: int):
    """
    Background task: resolve recipients and dispatch messages.

    Branches on campaign.channel — 'whatsapp' or 'email'.
    Idempotent: if re-queued on a partially-sent campaign it only retries PENDING rows.

    State machine: pending -> sending -> completed (or failed if 0 sent)
    """
    from apps.events.models import MessageCampaign

    try:
        campaign = MessageCampaign.objects.select_related(
            'event', 'event__host', 'template'
        ).get(pk=campaign_id)
    except MessageCampaign.DoesNotExist:
        logger.error('[Campaign] Campaign %d not found — task aborted', campaign_id)
        return

    if campaign.status == MessageCampaign.STATUS_CANCELLED:
        logger.info('[Campaign] %d cancelled — skipping dispatch', campaign_id)
        return

    # Transition to SENDING
    campaign.status = MessageCampaign.STATUS_SENDING
    campaign.started_at = timezone.now()
    campaign.save(update_fields=['status', 'started_at', 'updated_at'])

    if campaign.channel == MessageCampaign.CHANNEL_EMAIL:
        _run_email_campaign(campaign)
    else:
        _run_whatsapp_campaign(campaign)


# ---------------------------------------------------------------------------
# WhatsApp dispatch
# ---------------------------------------------------------------------------

def _run_whatsapp_campaign(campaign):
    from apps.events.models import CampaignRecipient, Guest
    from apps.common.whatsapp_backend import send_whatsapp_message, replace_template_variables

    event = campaign.event

    if campaign.total_recipients == 0:
        all_qs = _build_guest_queryset(campaign, channel='whatsapp', require_contact=False)
        campaign.qualified_count = all_qs.count()
        guest_qs = _build_guest_queryset(campaign)
        to_create = []
        for guest in guest_qs:
            phone = (guest.phone or '').strip()
            if not phone:
                continue
            if not _PHONE_RE.match(phone):
                to_create.append(CampaignRecipient(
                    campaign=campaign, guest=guest, phone=phone,
                    status=CampaignRecipient.STATUS_SKIPPED,
                    error_message='Invalid phone — must start with + and country code',
                ))
                continue
            to_create.append(CampaignRecipient(
                campaign=campaign, guest=guest, phone=phone,
                status=CampaignRecipient.STATUS_PENDING,
            ))
        if to_create:
            CampaignRecipient.objects.bulk_create(to_create, ignore_conflicts=True)
        campaign.total_recipients = len(to_create)
        campaign.save(update_fields=['qualified_count', 'total_recipients', 'updated_at'])

    delay = getattr(settings, 'WHATSAPP_SEND_DELAY_SECONDS', 0.2)
    pending = CampaignRecipient.objects.filter(
        campaign=campaign, status=CampaignRecipient.STATUS_PENDING
    ).select_related('guest')

    sent = failed = 0

    for recipient in pending:
        resolved = replace_template_variables(
            campaign.message_body, guest=recipient.guest, event=event,
        )
        recipient.resolved_message = resolved

        result = send_whatsapp_message(
            to_phone=recipient.phone,
            message_body=resolved,
            message_mode=campaign.message_mode,
            meta_template_name=campaign.meta_template_name,
            meta_template_language=campaign.meta_template_language,
            campaign_recipient_id=recipient.pk,
        )

        if result['success']:
            recipient.status = CampaignRecipient.STATUS_SENT
            recipient.whatsapp_message_id = result['whatsapp_message_id'] or ''
            recipient.sent_at = timezone.now()
            sent += 1
            if campaign.template and campaign.template.message_type == 'invitation':
                Guest.objects.filter(pk=recipient.guest_id).update(
                    invitation_sent=True, invitation_sent_at=timezone.now(),
                )
        else:
            recipient.status = CampaignRecipient.STATUS_FAILED
            recipient.error_message = result['error'] or ''
            failed += 1

        recipient.save(update_fields=[
            'resolved_message', 'status', 'whatsapp_message_id',
            'sent_at', 'error_message', 'updated_at',
        ])
        time.sleep(delay)

    _finalise_campaign(campaign)
    logger.info('[WhatsApp Campaign] %d done — sent=%d failed=%d', campaign.id, sent, failed)


# ---------------------------------------------------------------------------
# Email dispatch
# ---------------------------------------------------------------------------

def _run_email_campaign(campaign):
    from apps.events.models import CampaignRecipient, Guest
    from apps.common.whatsapp_backend import replace_template_variables
    from apps.common.email_backend import send_campaign_email, get_flyer_image_url

    event = campaign.event
    is_rich_text = campaign.template.is_rich_text if campaign.template else False
    subject = campaign.subject or (campaign.template.subject if campaign.template else '') or campaign.name
    from_name = getattr(event.host, 'name', '') or ''

    # Resolve [flyer_image_url] once per campaign
    flyer_url = get_flyer_image_url(event)
    extra_vars = {'[flyer_image_url]': flyer_url}

    if campaign.total_recipients == 0:
        all_qs = _build_guest_queryset(campaign, channel='email', require_contact=False)
        campaign.qualified_count = all_qs.count()
        guest_qs = _build_guest_queryset(campaign, channel='email')
        to_create = []
        for guest in guest_qs:
            email = (guest.email or '').strip()
            if not email:
                continue
            to_create.append(CampaignRecipient(
                campaign=campaign,
                guest=guest,
                email=email,
                phone=(guest.phone or '').strip(),
                status=CampaignRecipient.STATUS_PENDING,
            ))
        if to_create:
            CampaignRecipient.objects.bulk_create(to_create, ignore_conflicts=True)
        campaign.total_recipients = len(to_create)
        campaign.save(update_fields=['qualified_count', 'total_recipients', 'updated_at'])

    delay = getattr(settings, 'EMAIL_SEND_DELAY_SECONDS', 0.05)
    pending = CampaignRecipient.objects.filter(
        campaign=campaign, status=CampaignRecipient.STATUS_PENDING
    ).select_related('guest')

    sent = failed = 0

    for recipient in pending:
        resolved = replace_template_variables(
            campaign.message_body, guest=recipient.guest, event=event, extra=extra_vars,
        )
        recipient.resolved_message = resolved

        result = send_campaign_email(
            to_email=recipient.email,
            subject=subject,
            body=resolved,
            is_rich_text=is_rich_text,
            recipient_id=recipient.pk,
            from_name=from_name,
        )

        if result['success']:
            recipient.status = CampaignRecipient.STATUS_SENT
            recipient.email_message_id = result['email_message_id'] or ''
            recipient.sent_at = timezone.now()
            sent += 1
            if campaign.template and campaign.template.message_type == 'invitation':
                Guest.objects.filter(pk=recipient.guest_id).update(
                    invitation_sent=True, invitation_sent_at=timezone.now(),
                )
        else:
            recipient.status = CampaignRecipient.STATUS_FAILED
            recipient.error_message = result['error'] or ''
            failed += 1

        recipient.save(update_fields=[
            'resolved_message', 'status', 'email_message_id',
            'sent_at', 'error_message', 'updated_at',
        ])
        time.sleep(delay)

    _finalise_campaign(campaign)
    logger.info('[Email Campaign] %d done — sent=%d failed=%d', campaign.id, sent, failed)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _finalise_campaign(campaign):
    from apps.events.models import CampaignRecipient

    campaign.sent_count = CampaignRecipient.objects.filter(
        campaign=campaign,
        status__in=[
            CampaignRecipient.STATUS_SENT,
            CampaignRecipient.STATUS_DELIVERED,
            CampaignRecipient.STATUS_READ,
        ]
    ).count()
    campaign.failed_count = CampaignRecipient.objects.filter(
        campaign=campaign, status=CampaignRecipient.STATUS_FAILED
    ).count()

    if campaign.sent_count == 0 and campaign.failed_count > 0:
        campaign.status = campaign.STATUS_FAILED
    else:
        campaign.status = campaign.STATUS_COMPLETED

    campaign.completed_at = timezone.now()
    campaign.save(update_fields=[
        'status', 'sent_count', 'failed_count', 'completed_at', 'updated_at',
    ])


def _build_guest_queryset(campaign, channel: str = 'whatsapp', require_contact: bool = True):
    """
    Translate campaign.guest_filter into a Guest queryset.

    require_contact=True  (default): excludes guests missing the channel contact field.
    require_contact=False: applies only the filter logic, no contact field exclusion.
    """
    from apps.events.models import Guest, RSVP, MessageCampaign, SlotBooking

    base = Guest.objects.filter(event=campaign.event, is_removed=False)
    if require_contact:
        if channel == 'email':
            base = base.exclude(email__isnull=True).exclude(email='')
        else:
            base = base.exclude(phone='')

    f = campaign.guest_filter

    if f == MessageCampaign.FILTER_ALL:
        return base

    if f == MessageCampaign.FILTER_NOT_SENT:
        return base.filter(invitation_sent=False)

    if f == MessageCampaign.FILTER_RSVP_YES:
        ids = RSVP.objects.filter(
            event=campaign.event, will_attend='yes',
            is_removed=False, guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.filter(pk__in=ids)

    if f == MessageCampaign.FILTER_RSVP_NO:
        ids = RSVP.objects.filter(
            event=campaign.event, will_attend='no',
            is_removed=False, guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.filter(pk__in=ids)

    if f == MessageCampaign.FILTER_RSVP_MAYBE:
        ids = RSVP.objects.filter(
            event=campaign.event, will_attend='maybe',
            is_removed=False, guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.filter(pk__in=ids)

    if f == MessageCampaign.FILTER_RSVP_PENDING:
        guests_with_rsvp = RSVP.objects.filter(
            event=campaign.event, is_removed=False, guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.exclude(pk__in=guests_with_rsvp)

    if f == MessageCampaign.FILTER_RELATIONSHIP:
        return base.filter(relationship__iexact=campaign.filter_relationship)

    if f == MessageCampaign.FILTER_CUSTOM:
        return base.filter(pk__in=campaign.custom_guest_ids)

    if f == MessageCampaign.FILTER_BOOKING_SLOT:
        if not campaign.filter_slot_id:
            return base.none()
        ids = SlotBooking.objects.filter(
            event=campaign.event,
            slot_id=campaign.filter_slot_id,
            status=SlotBooking.STATUS_CONFIRMED,
            guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.filter(pk__in=ids)

    if f == MessageCampaign.FILTER_BOOKING_DATE:
        if not campaign.filter_slot_date:
            return base.none()
        ids = SlotBooking.objects.filter(
            event=campaign.event,
            slot__slot_date=campaign.filter_slot_date,
            status=SlotBooking.STATUS_CONFIRMED,
            guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.filter(pk__in=ids)

    if f == MessageCampaign.FILTER_BOOKING_STATUS:
        if not campaign.filter_booking_status:
            return base.none()
        ids = SlotBooking.objects.filter(
            event=campaign.event,
            status=campaign.filter_booking_status,
            guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.filter(pk__in=ids)

    return base  # fallback
