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
    Background task: resolve recipients and dispatch WhatsApp messages.

    Called by the campaign launch API endpoint. Idempotent — if re-queued
    on a partially-sent campaign it only sends to PENDING recipients.

    State machine:
        pending -> sending -> completed (or failed if 0 sent)
    """
    from apps.events.models import MessageCampaign, CampaignRecipient, Guest
    from apps.common.whatsapp_backend import send_whatsapp_message, replace_template_variables

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

    event = campaign.event

    # Build recipient rows on first run
    if campaign.total_recipients == 0:
        guest_qs = _build_guest_queryset(campaign)
        recipients_to_create = []
        for guest in guest_qs:
            if not guest.phone:
                continue
            phone = guest.phone.strip()
            if not _PHONE_RE.match(phone):
                recipients_to_create.append(CampaignRecipient(
                    campaign=campaign,
                    guest=guest,
                    phone=phone,
                    status=CampaignRecipient.STATUS_SKIPPED,
                    error_message='Invalid phone format — must start with + and country code (e.g. +919876543210)',
                ))
                continue
            recipients_to_create.append(CampaignRecipient(
                campaign=campaign,
                guest=guest,
                phone=phone,
                status=CampaignRecipient.STATUS_PENDING,
            ))
        if recipients_to_create:
            CampaignRecipient.objects.bulk_create(
                recipients_to_create, ignore_conflicts=True
            )
        campaign.total_recipients = len(recipients_to_create)
        campaign.save(update_fields=['total_recipients', 'updated_at'])

    # Send pending recipients
    delay = getattr(settings, 'WHATSAPP_SEND_DELAY_SECONDS', 0.2)
    pending_recipients = CampaignRecipient.objects.filter(
        campaign=campaign, status=CampaignRecipient.STATUS_PENDING
    ).select_related('guest')

    sent = 0
    failed = 0

    for recipient in pending_recipients:
        resolved = replace_template_variables(
            campaign.message_body,
            guest=recipient.guest,
            event=event,
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
            # Update Guest.invitation_sent for invitation-type campaigns
            if campaign.template and campaign.template.message_type == 'invitation':
                Guest.objects.filter(pk=recipient.guest_id).update(
                    invitation_sent=True,
                    invitation_sent_at=timezone.now(),
                )
        else:
            recipient.status = CampaignRecipient.STATUS_FAILED
            recipient.error_message = result['error'] or ''
            failed += 1

        recipient.save(update_fields=[
            'resolved_message', 'status', 'whatsapp_message_id',
            'sent_at', 'error_message', 'updated_at'
        ])

        time.sleep(delay)

    # Final campaign status
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
        campaign.status = MessageCampaign.STATUS_FAILED
    else:
        campaign.status = MessageCampaign.STATUS_COMPLETED

    campaign.completed_at = timezone.now()
    campaign.save(update_fields=[
        'status', 'sent_count', 'failed_count', 'completed_at', 'updated_at'
    ])
    logger.info(
        '[Campaign] %d completed — sent=%d failed=%d', campaign_id, sent, failed
    )


def _build_guest_queryset(campaign):
    """
    Translate campaign.guest_filter into a Guest queryset.
    Base: is_removed=False, phone not empty.
    """
    from apps.events.models import Guest, RSVP, MessageCampaign

    base = Guest.objects.filter(
        event=campaign.event, is_removed=False
    ).exclude(phone='')

    f = campaign.guest_filter

    if f == MessageCampaign.FILTER_ALL:
        return base

    if f == MessageCampaign.FILTER_NOT_SENT:
        return base.filter(invitation_sent=False)

    if f == MessageCampaign.FILTER_RSVP_YES:
        rsvp_guest_ids = RSVP.objects.filter(
            event=campaign.event, will_attend='yes',
            is_removed=False, guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.filter(pk__in=rsvp_guest_ids)

    if f == MessageCampaign.FILTER_RSVP_NO:
        rsvp_guest_ids = RSVP.objects.filter(
            event=campaign.event, will_attend='no',
            is_removed=False, guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.filter(pk__in=rsvp_guest_ids)

    if f == MessageCampaign.FILTER_RSVP_MAYBE:
        rsvp_guest_ids = RSVP.objects.filter(
            event=campaign.event, will_attend='maybe',
            is_removed=False, guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.filter(pk__in=rsvp_guest_ids)

    if f == MessageCampaign.FILTER_RSVP_PENDING:
        guests_with_rsvp = RSVP.objects.filter(
            event=campaign.event, is_removed=False, guest__isnull=False,
        ).values_list('guest_id', flat=True)
        return base.exclude(pk__in=guests_with_rsvp)

    if f == MessageCampaign.FILTER_RELATIONSHIP:
        return base.filter(relationship__iexact=campaign.filter_relationship)

    if f == MessageCampaign.FILTER_CUSTOM:
        return base.filter(pk__in=campaign.custom_guest_ids)

    return base  # fallback
