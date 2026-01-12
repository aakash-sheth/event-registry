from rest_framework import viewsets, status
from rest_framework import serializers as drf_serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied, NotFound
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, Http404
from django.conf import settings
from django.utils import timezone
import csv
import os
from urllib.parse import quote
from .models import Event, RSVP, Guest, InvitePage, SubEvent, GuestSubEventInvite, MessageTemplate
from .serializers import (
    EventSerializer, EventCreateSerializer,
    RSVPSerializer, RSVPCreateSerializer,
    GuestSerializer, GuestCreateSerializer,
    InvitePageSerializer, InvitePageCreateSerializer, InvitePageUpdateSerializer,
    SubEventSerializer, SubEventCreateSerializer,
    GuestSubEventInviteSerializer,
    MessageTemplateSerializer
)
import re
from .utils import get_country_code, format_phone_with_country_code, normalize_csv_header, upload_to_s3, parse_phone_number
from apps.items.models import RegistryItem
from apps.items.serializers import RegistryItemSerializer
from django.core.cache import cache
import threading
from collections import defaultdict
import time
import boto3
from botocore.exceptions import ClientError


def get_invite_page_cache_key(slug, guest_token=None):
    """Generate cache key for invite page response"""
    if guest_token:
        return f'invite_page:{slug}:guest:{guest_token}'
    return f'invite_page:{slug}'


def invalidate_invite_page_cache(slug):
    """Invalidate all cache entries for an invite page"""
    # Invalidate public cache
    cache.delete(f'invite_page:{slug}')
    # Note: Guest-specific caches will expire naturally (shorter TTL)


# Global debounce state for CloudFront invalidations
_invalidation_queue = defaultdict(lambda: {'last_save': 0, 'timer': None})
_invalidation_lock = threading.Lock()


def invalidate_cloudfront_cache_immediate(slug):
    """Immediate CloudFront invalidation using boto3"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Get CloudFront distribution ID from environment or SSM
        distribution_id = os.environ.get('CLOUDFRONT_DISTRIBUTION_ID')
        if not distribution_id:
            try:
                ssm = boto3.client('ssm', region_name='us-east-1')
                response = ssm.get_parameter(
                    Name='/event-registry-staging/CLOUDFRONT_DISTRIBUTION_ID'
                )
                distribution_id = response['Parameter']['Value']
            except Exception as e:
                logger.warning(f"[Cache] CloudFront distribution ID not found: {e}")
                return
        
        if not distribution_id:
            return
        
        # Create CloudFront client
        cloudfront = boto3.client('cloudfront', region_name='us-east-1')
        
        # Use wildcard to minimize paths (counts as 1 path - industry standard)
        paths = [f'/invite/{slug}/*']
        
        # Create invalidation
        response = cloudfront.create_invalidation(
            DistributionId=distribution_id,
            InvalidationBatch={
                'Paths': {
                    'Quantity': 1,
                    'Items': paths
                },
                'CallerReference': f'invite-{slug}-{int(time.time())}'
            }
        )
        
        invalidation_id = response['Invalidation']['Id']
        logger.info(
            f"[Cache] CloudFront invalidation created - slug: {slug}, "
            f"invalidation_id: {invalidation_id}, paths: {paths}"
        )
        
    except ClientError as e:
        logger.error(f"[Cache] CloudFront invalidation failed: {e}")
    except Exception as e:
        logger.error(f"[Cache] CloudFront invalidation error: {e}")


def invalidate_cloudfront_cache_debounced(slug, debounce_seconds=30):
    """
    Debounced CloudFront invalidation - batches saves within time window
    Industry standard: Reduces invalidation costs by 90-95%
    """
    import logging
    logger = logging.getLogger(__name__)
    
    with _invalidation_lock:
        now = time.time()
        queue_entry = _invalidation_queue[slug]
        
        # If we recently invalidated, skip (debounce)
        if now - queue_entry['last_save'] < debounce_seconds:
            # Cancel existing timer if any
            if queue_entry['timer']:
                queue_entry['timer'].cancel()
            
            # Schedule delayed invalidation
            def delayed_invalidate():
                time.sleep(debounce_seconds - (now - queue_entry['last_save']))
                invalidate_cloudfront_cache_immediate(slug)
                with _invalidation_lock:
                    _invalidation_queue[slug]['last_save'] = time.time()
                    _invalidation_queue[slug]['timer'] = None
            
            queue_entry['timer'] = threading.Timer(
                debounce_seconds - (now - queue_entry['last_save']),
                delayed_invalidate
            )
            queue_entry['timer'].start()
            logger.info(
                f"[Cache] Debounced invalidation for {slug} "
                f"(will invalidate in {debounce_seconds - (now - queue_entry['last_save']):.1f}s)"
            )
            return
        
        # Invalidate immediately (first save or after debounce window)
        invalidate_cloudfront_cache_immediate(slug)
        queue_entry['last_save'] = now
        queue_entry['timer'] = None


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def get_queryset(self):
        try:
            return Event.objects.filter(host=self.request.user)
        except Exception:
            try:
                return Event.objects.filter(host=self.request.user).only(
                    'id', 'host_id', 'slug', 'title', 'event_type', 'date',
                    'city', 'country', 'is_public', 'has_rsvp',
                    'has_registry', 'banner_image', 'description',
                    'additional_photos', 'page_config',
                    'created_at', 'updated_at'
                )
            except Exception:
                return Event.objects.none()

    def get_object(self):
        obj = super().get_object()
        if obj.host != self.request.user:
            raise PermissionDenied("You can only access your own events.")
        return obj

    def get_serializer_class(self):
        if self.action == 'create':
            return EventCreateSerializer
        return EventSerializer

    def perform_create(self, serializer):
        serializer.save(host=self.request.user)

    def _verify_event_ownership(self, event):
        if not self.request.user.is_authenticated:
            raise PermissionDenied("Authentication required.")
        if event.host != self.request.user:
            raise PermissionDenied("You can only access your own events.")
        return True

    # -------------------------
    # ORDERS
    # -------------------------
    @action(detail=True, methods=['get'])
    def orders(self, request, id=None):
        event = self.get_object()
        self._verify_event_ownership(event)

        from apps.orders.models import Order
        from apps.orders.serializers import OrderSerializer

        orders = Order.objects.filter(event=event).order_by('-created_at')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    # -------------------------
    # RSVPS
    # -------------------------
    @action(detail=True, methods=['get'])
    def rsvps(self, request, id=None):
        event = self.get_object()
        self._verify_event_ownership(event)

        rsvps = RSVP.objects.filter(
            event=event,
            is_removed=False
        ).order_by('-created_at')

        serializer = RSVPSerializer(rsvps, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['delete'], url_path='rsvps/(?P<rsvp_id>[^/.]+)')
    def delete_rsvp(self, request, id=None, rsvp_id=None):
        event = self.get_object()
        self._verify_event_ownership(event)

        try:
            rsvp = RSVP.objects.get(id=rsvp_id, event=event)
        except RSVP.DoesNotExist:
            return Response(
                {'error': 'RSVP not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        rsvp.is_removed = True
        rsvp.save()

        return Response(
            {
                'message': 'RSVP removed (soft delete)',
                'soft_delete': True
            },
            status=status.HTTP_200_OK
        )

    # -------------------------
    # GUESTS
    # -------------------------
    @action(detail=True, methods=['get', 'post'])
    def guests(self, request, id=None):
        event = self.get_object()
        self._verify_event_ownership(event)

        if request.method == 'GET':
            guests = Guest.objects.filter(event=event, is_removed=False)
            serializer = GuestSerializer(guests, many=True)
            return Response(serializer.data)

        # POST
        guests_data = request.data.get('guests', [])
        if not isinstance(guests_data, list):
            return Response(
                {'error': 'guests must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )

        created = []
        errors = []
        event_country_code = get_country_code(event.country)

        for idx, guest_data in enumerate(guests_data):
            serializer = GuestCreateSerializer(data=guest_data)
            if not serializer.is_valid():
                errors.append({idx: serializer.errors})
                continue

            phone = serializer.validated_data.get('phone')
            if phone and not phone.startswith('+'):
                phone = format_phone_with_country_code(
                    phone,
                    guest_data.get('country_code') or event_country_code
                )

            if Guest.objects.filter(event=event, phone=phone).exists():
                errors.append(f"Phone already exists: {phone}")
                continue

            guest = Guest.objects.create(
                event=event,
                phone=phone,
                name=serializer.validated_data.get('name'),
                email=serializer.validated_data.get('email'),
                relationship=serializer.validated_data.get('relationship', ''),
                notes=serializer.validated_data.get('notes', '')
            )
            created.append(guest)

        response = {'created': GuestSerializer(created, many=True).data}
        if errors:
            response['errors'] = errors

        return Response(
            response,
            status=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST
        )

    def update_guest(self, request, id=None, guest_id=None):
        """Update a guest (PUT/PATCH)"""
        event = self.get_object()
        self._verify_event_ownership(event)
        
        try:
            guest = Guest.objects.get(id=guest_id, event=event)
        except Guest.DoesNotExist:
            return Response(
                {'error': 'Guest not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Use GuestSerializer for update (allows updating invitation_sent fields)
        serializer = GuestSerializer(guest, data=request.data, partial=request.method == 'PATCH')
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete_guest(self, request, id=None, guest_id=None):
        """Delete or soft-delete a guest"""
        event = self.get_object()
        self._verify_event_ownership(event)
        
        try:
            guest = Guest.objects.get(id=guest_id, event=event)
        except Guest.DoesNotExist:
            return Response(
                {'error': 'Guest not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if guest has RSVP - if yes, soft delete; if no, hard delete
        has_rsvp = RSVP.objects.filter(guest=guest, is_removed=False).exists()
        
        if has_rsvp:
            # Soft delete
            guest.is_removed = True
            guest.save(update_fields=['is_removed', 'updated_at'])
            return Response(
                {'message': 'Guest removed (soft delete). Record preserved.', 'soft_delete': True},
                status=status.HTTP_200_OK
            )
        else:
            # Hard delete
            guest.delete()
            return Response(
                {'message': 'Guest deleted successfully', 'soft_delete': False},
                status=status.HTTP_200_OK
            )

    # -------------------------
    # DESIGN / PAGE CONFIG
    # -------------------------
    @action(detail=True, methods=['put', 'patch'])
    def update_design(self, request, id=None):
        """Update event page_config and sync to InvitePage if it exists"""
        import logging
        logger = logging.getLogger(__name__)
        
        event = self.get_object()
        self._verify_event_ownership(event)
        
        try:
            page_config = request.data.get('page_config')
            if page_config is None:
                return Response(
                    {'error': 'page_config is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Update event's page_config
            event.page_config = page_config
            event.save(update_fields=['page_config', 'updated_at'])
            
            # Sync to InvitePage if it exists, or create one
            invite_page_created = False
            invite_page = None
            try:
                invite_page = InvitePage.objects.get(event=event)
                # Update invite page config
                invite_page.config = page_config
                invite_page.save(update_fields=['config', 'updated_at'])
                # Invalidate cache after updating config
                if invite_page.slug:
                    # Invalidate backend cache immediately (no delay)
                    invalidate_invite_page_cache(invite_page.slug)
                    # Immediate CloudFront invalidation for design updates
                    # This ensures preview windows see changes instantly (<1s latency)
                    # Cost: ~$0.005 per invalidation, acceptable for design tool usage
                    # Note: Public page saves can still use debounced invalidation if needed
                    invalidate_cloudfront_cache_immediate(invite_page.slug)
                    logger.info(
                        f"[Cache] INVALIDATE - slug: {invite_page.slug}, "
                        f"reason: invite_page_config_updated (immediate)"
                    )
                logger.info(f"Updated InvitePage config for event {event.id}")
            except InvitePage.DoesNotExist:
                # Auto-create InvitePage if it doesn't exist
                if event.slug:
                    invite_page = InvitePage.objects.create(
                        event=event,
                        slug=event.slug.lower(),
                        config=page_config,
                        background_url=event.banner_image or '',
                        is_published=False
                    )
                    invite_page_created = True
                    logger.info(f"Auto-created InvitePage for event {event.id}")
                else:
                    logger.warning(f"Cannot create InvitePage: event {event.id} has no slug")
            
            # Return updated event data
            serializer = self.get_serializer(event)
            response_data = serializer.data
            response_data['invite_page_created'] = invite_page_created
            if invite_page:
                response_data['is_published'] = invite_page.is_published
            
            return Response(response_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error updating design for event {event.id}: {str(e)}", exc_info=True)
            return Response(
                {'error': f'Failed to update design: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'], url_path='description-variables')
    def description_variables(self, request, id=None):
        """Get available variables for event descriptions (name + custom fields only)"""
        event = self.get_object()
        self._verify_event_ownership(event)
        
        # Get variables (only [name] and custom CSV fields)
        variables = self._get_description_variables(event)
        return Response({'variables': variables})
    
    @action(detail=True, methods=['get'], url_path='system-default-template')
    def get_system_default_template(self, request, id=None):
        """Get the system default WhatsApp template (global template visible in all events)"""
        event = self.get_object()
        self._verify_event_ownership(event)
        
        # Get the system default template (there should only be one globally)
        system_template = MessageTemplate.objects.filter(is_system_default=True).first()
        
        if not system_template:
            # Auto-create system default template if it doesn't exist
            # This ensures it's always available for all events
            from django.contrib.auth import get_user_model
            User = get_user_model()
            
            # Get or create a system event for the template
            system_event, _ = Event.objects.get_or_create(
                slug='system-default',
                defaults={
                    'title': 'System Default Template Event',
                    'host': User.objects.first(),  # Use first user as placeholder
                    'event_type': 'other',
                    'is_public': False,
                }
            )
            
            # Create system default template
            system_template = MessageTemplate.objects.create(
                event=system_event,
                name='System Default Invitation',
                message_type='invitation',
                template_text='Hey [name]! 💛\n\nJust wanted to share [event_title] on [event_date]!\n\nPlease confirm here: [event_url]\n\n- [host_name]',
                description='Default template used when no event-specific default is set. This is a global template visible in all events.',
                is_system_default=True,
                is_default=False,  # Not an event default, but system default
                is_active=True,
            )
        
        # Return the template serialized
        serializer = MessageTemplateSerializer(system_template)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'], url_path='whatsapp-templates/available-variables')
    def get_available_variables(self, request, id=None):
        """Get available variables for WhatsApp templates (default + custom from CSV)"""
        event = self.get_object()
        self._verify_event_ownership(event)
        
        variables = []
        
        # Default variables
        default_vars = [
            {'key': '[name]', 'label': 'Guest Name', 'description': 'Name of the guest', 'example': 'Sarah'},
            {'key': '[event_title]', 'label': 'Event Title', 'description': 'Title of the event', 'example': event.title or 'Event Title'},
            {'key': '[event_date]', 'label': 'Event Date', 'description': 'Date of the event', 'example': event.date.strftime('%B %d, %Y') if event.date else 'TBD'},
            {'key': '[event_url]', 'label': 'Event URL', 'description': 'Link to the event invitation', 'example': f'https://example.com/invite/{event.slug}' if event.slug else 'https://example.com/invite/event-slug'},
            {'key': '[host_name]', 'label': 'Host Name', 'description': 'Name of the event host', 'example': getattr(event.host, 'name', None) or getattr(event.host, 'username', 'Host')},
            {'key': '[event_location]', 'label': 'Event Location', 'description': 'Location of the event', 'example': event.city or 'Location TBD'},
            {'key': '[map_direction]', 'label': 'Map Direction Link', 'description': 'Google Maps link to event location', 'example': 'https://maps.google.com/?q=Location'},
        ]
        variables.extend(default_vars)
        
        # Custom variables from CSV imports
        custom_metadata = event.custom_fields_metadata or {}
        for normalized_key, metadata in custom_metadata.items():
            if isinstance(metadata, dict):
                display_label = metadata.get('display_label', normalized_key)
                example = metadata.get('example', '—')
            else:
                # Backward compatibility: if metadata is just a string (old format)
                display_label = metadata
                example = '—'
            
            variables.append({
                'key': f'[{normalized_key}]',
                'label': display_label,
                'description': f'Custom field from CSV: {display_label}',
                'example': example,
                'is_custom': True,
            })
        
        return Response({'variables': variables})
    
    def _get_description_variables(self, event):
        """Get list of available variables for event descriptions (guest-safe only)"""
        variables = []
        
        # Only guest-specific variables
        variables.append({
            'key': '[name]',
            'label': 'Guest Name',
            'description': 'Name of the guest (personalizes the description)',
            'example': 'Sarah',
        })
        
        # Custom variables from CSV
        custom_metadata = event.custom_fields_metadata or {}
        for normalized_key, metadata in custom_metadata.items():
            if isinstance(metadata, dict):
                display_label = metadata.get('display_label', normalized_key)
                example = metadata.get('example', '—')
            else:
                # Backward compatibility: if metadata is just a string (old format)
                display_label = metadata
                example = '—'
            
            variables.append({
                'key': f'[{normalized_key}]',
                'label': display_label,
                'description': f'Custom field from CSV: {display_label}',
                'example': example,
                'is_custom': True,
            })
        
        return variables


# Helper function to handle invite page operations by event_id
@api_view(['GET', 'POST', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def invite_page_by_event(request, event_id):
    """Handle invite page operations by event_id - wrapper for InvitePageViewSet"""
    from django.http import Http404
    from rest_framework.exceptions import PermissionDenied
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Verify event exists and user owns it
    try:
        event = get_object_or_404(Event, id=event_id, host=request.user)
    except Http404:
        raise Http404("Event not found or you do not have permission")
    
    # Get or create invite page
    try:
        invite_page = InvitePage.objects.select_related('event').get(event=event)
    except InvitePage.DoesNotExist:
        # For GET requests, return 404 if invite page doesn't exist
        if request.method == 'GET':
            raise Http404("Invite page not found for this event")
        # For POST, create a new invite page
        if request.method == 'POST':
            # Create will be handled by the ViewSet
            pass
        else:
            raise Http404("Invite page not found for this event")
    
    # Create ViewSet instance and set up properly
    viewset = InvitePageViewSet()
    viewset.request = request
    viewset.format_kwarg = None
    viewset.kwargs = {'event_id': event_id}
    
    # Set action based on method
    if request.method == 'GET':
        viewset.action = 'retrieve'
        # Manually call get_object with event_id
        viewset.kwargs['event_id'] = event_id
        return viewset.retrieve(request)
    elif request.method == 'POST':
        viewset.action = 'create'
        viewset.kwargs['event_id'] = event_id
        return viewset.create(request)
    elif request.method == 'PUT':
        viewset.action = 'update'
        viewset.kwargs['event_id'] = event_id
        return viewset.update(request)
    elif request.method == 'PATCH':
        viewset.action = 'partial_update'
        viewset.kwargs['event_id'] = event_id
        return viewset.partial_update(request)


class InvitePageViewSet(viewsets.ModelViewSet):
    """
    Invite page management - host only, privacy protected
    """
    serializer_class = InvitePageSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        """Hosts can only see invite pages for their own events"""
        return InvitePage.objects.filter(event__host=self.request.user)

    def get_object(self):
        """Override to retrieve invite page by event_id instead of id"""
        from django.http import Http404
        from rest_framework.exceptions import PermissionDenied

        # If event_id is in kwargs (from URL), get invite page by event
        event_id = self.kwargs.get('event_id')
        if event_id:
            try:
                event = get_object_or_404(Event, id=event_id, host=self.request.user)
            except Http404:
                raise Http404("Event not found or you do not have permission")
            except Exception as e:
                raise Http404(f"Error accessing event: {str(e)}")

            try:
                invite_page = InvitePage.objects.select_related('event').get(event=event)

                # Verify ownership (double-check)
                if invite_page.event.host != self.request.user:
                    raise PermissionDenied("You can only access invite pages for your own events.")

                # Ensure event relationship is fully loaded for serializer
                if not hasattr(invite_page, '_event_cache'):
                    _ = invite_page.event

                return invite_page
            except InvitePage.DoesNotExist:
                raise Http404("Invite page not found for this event")

        # Otherwise, use default behavior (lookup by id)
        try:
            obj = super().get_object()
        except Exception as e:
            raise Http404(f"Invite page not found: {str(e)}")

        # Ensure event relationship is loaded to avoid issues in serializer
        try:
            if not hasattr(obj, '_event_cache'):
                _ = obj.event

            if obj.event.host != self.request.user:
                raise PermissionDenied("You can only access invite pages for your own events.")
        except AttributeError as e:
            raise Http404(f"Error accessing event relationship: {str(e)}")

        return obj

    def get_serializer_class(self):
        if self.action == 'create':
            return InvitePageCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return InvitePageUpdateSerializer
        return InvitePageSerializer

    def create(self, request, *args, **kwargs):
        """Create invite page for an event"""
        import logging
        logger = logging.getLogger(__name__)

        try:
            event_id = self.kwargs.get('event_id')
            if not event_id:
                return Response(
                    {'error': 'event_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get event with proper error handling
            try:
                event = Event.objects.select_related('host').get(id=event_id, host=request.user)
            except Event.DoesNotExist:
                logger.warning(f"Event {event_id} not found or user {request.user.id} doesn't own it")
                return Response(
                    {'error': 'Event not found or you do not have permission'},
                    status=status.HTTP_404_NOT_FOUND
                )
            except Exception as e:
                logger.error(f"Error getting event {event_id}: {str(e)}", exc_info=True)
                return Response(
                    {'error': 'Error accessing event'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Check if invite page already exists - if so, return existing one instead of error
            try:
                existing_invite = InvitePage.objects.select_related('event').filter(event=event).first()
                if existing_invite:
                    logger.info(f"Invite page already exists for event {event_id}, returning existing one")
                    _ = existing_invite.event
                    serializer = InvitePageSerializer(existing_invite)
                    return Response(serializer.data, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error checking for existing invite page: {str(e)}", exc_info=True)
                # Continue to create new one

            # Validate serializer
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                logger.error(f"Serializer validation failed: {serializer.errors}")
                return Response(
                    {'error': 'Invalid data', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create new invite page
            try:
                invite_page = serializer.save(event=event)
                _ = invite_page.event
                response_serializer = InvitePageSerializer(invite_page)
                return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Error creating invite page: {str(e)}", exc_info=True)
                return Response(
                    {'error': f'Failed to create invite page: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            logger.error(f"Unexpected error in create(): {str(e)}", exc_info=True)
            return Response(
                {'error': f'Unexpected error: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, *args, **kwargs):
        """Retrieve invite page by event_id"""
        from django.http import Http404
        from rest_framework.exceptions import PermissionDenied
        import logging
        logger = logging.getLogger(__name__)

        try:
            # Ensure action is set (needed when using as_view with dict)
            if not hasattr(self, 'action'):
                self.action = 'retrieve'

            instance = self.get_object()

            # Ensure event relationship is fully loaded before serialization
            try:
                if hasattr(instance, 'event'):
                    if not hasattr(instance, '_event_cache'):
                        instance = InvitePage.objects.select_related('event').get(pk=instance.pk)

                    event = instance.event
                    if not event:
                        raise AttributeError("Event relationship is None")

                    _ = event.slug
                    _ = event.event_structure
                    _ = event.rsvp_mode
                else:
                    raise AttributeError("InvitePage has no event attribute")

            except AttributeError as e:
                logger.error(f"Error accessing event relationship: {str(e)}", exc_info=True)
                return Response(
                    {'error': 'Error loading event data for invite page'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            except Exception as e:
                logger.error(f"Error loading event data: {str(e)}", exc_info=True)
                return Response(
                    {'error': f'Error loading event data: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Create serializer with proper context
            try:
                serializer = self.get_serializer(instance)
                return Response(serializer.data)
            except Exception as e:
                logger.error(f"Error serializing invite page: {str(e)}", exc_info=True)
                return Response(
                    {'error': f'Error serializing invite page: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Http404 as e:
            logger.info(f"Invite page not found: {str(e)}")
            return Response(
                {'error': 'Invite page not found for this event'},
                status=status.HTTP_404_NOT_FOUND
            )
        except PermissionDenied as e:
            logger.warning(f"Permission denied accessing invite page: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )
        except InvitePage.DoesNotExist:
            logger.info("Invite page does not exist")
            return Response(
                {'error': 'Invite page not found for this event'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error retrieving invite page: {str(e)}", exc_info=True)

            if 'DoesNotExist' in str(type(e).__name__) or 'Http404' in str(type(e).__name__):
                return Response(
                    {'error': 'Invite page not found for this event'},
                    status=status.HTTP_404_NOT_FOUND
                )

            return Response(
                {'error': f'Failed to retrieve invite page: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, id=None, slug=None):
        """Publish/unpublish invite page"""
        import logging
        logger = logging.getLogger(__name__)

        try:
            # Handle slug-based lookup (from /api/events/invite/<slug>/publish/)
            # Get slug from kwargs if not passed as parameter
            if not slug:
                Sslug = self.kwargs.get('slug')
            
            if slug:
                slug = slug.lower()
                try:
                    invite_page = InvitePage.objects.select_related('event').get(slug=slug)
                    if invite_page.event.host != request.user:
                        raise PermissionDenied("You can only publish invite pages for your own events.")
                except InvitePage.DoesNotExist:
                    raise NotFound(f"Invite page not found for slug: {slug}")
            else:
                invite_page = self.get_object()

            is_published = request.data.get('is_published', True)
            logger.info(
                f"Publishing invite page: slug={invite_page.slug}, is_published={is_published}, user={request.user.id}"
            )

            # Ensure slug exists before publishing
            if not invite_page.slug and invite_page.event:
                if invite_page.event.slug:
                    invite_page.slug = invite_page.event.slug.lower()
                    invite_page.is_published = is_published
                    invite_page.save(update_fields=['slug', 'is_published', 'updated_at'])
                else:
                    logger.error(f"Cannot publish invite page: event {invite_page.event.id} has no slug")
                    return Response(
                        {'error': 'Event slug is missing. Cannot publish invite page.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                invite_page.is_published = is_published
                invite_page.save(update_fields=['is_published', 'updated_at'])

            # Invalidate cache after publishing/unpublishing
            if invite_page.slug:
                invalidate_invite_page_cache(invite_page.slug)
                logger.info(
                    f"[Cache] INVALIDATE - slug: {invite_page.slug}, "
                    f"reason: invite_page_published_changed, is_published: {is_published}"
                )

            invite_page.refresh_from_db()
            return Response(InvitePageSerializer(invite_page).data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error publishing invite page: {str(e)}", exc_info=True)
            if isinstance(e, (PermissionDenied, NotFound)):
                raise
            return Response(
                {'error': f'Failed to publish invite page: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class PublicInviteViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public invite page view - no authentication required
    Supports guest token via ?g=<token> query parameter for guest-scoped rendering
    """
    serializer_class = InvitePageSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        """Only return published invite pages"""
        return InvitePage.objects.filter(is_published=True)

    def retrieve(self, request, *args, **kwargs):
        """Retrieve invite page with guest-scoped sub-events if token provided"""
        import logging
        import time
        from rest_framework.exceptions import NotFound

        logger = logging.getLogger(__name__)
        start_time = time.time()

        # Log only for debugging or errors, avoid excessive logging
        def debug_log(msg, level='INFO'):
            """Log with appropriate level"""
            log_msg = f"[PublicInviteViewSet] {msg}"
            if level == 'INFO':
                logger.info(log_msg)
            elif level == 'WARNING':
                logger.warning(log_msg)
            elif level == 'ERROR':
                logger.error(log_msg)
            elif level == 'DEBUG':
                logger.debug(log_msg)

        # Normalize slug to lowercase (all slugs are stored in lowercase)
        original_slug = kwargs.get('slug', '')
        slug = original_slug.lower() if original_slug else ''
        if original_slug != slug:
            logger.info(f"[PublicInviteViewSet.retrieve] Slug normalized: '{original_slug}' -> '{slug}'")
        else:
            logger.info(f"[PublicInviteViewSet.retrieve] Request received - Slug: '{slug}'")

        # Simplified lookup: Try invite page first, then event, then 404
        query_start = time.time()
        invite_page = None
        event = None

        # Check if this is an editor preview request
        is_preview = request.query_params.get('preview', '').lower() == 'true'
        
        # Check cache for published pages without guest tokens AND not editor preview
        guest_token = request.query_params.get('g', '').strip()
        if not guest_token and not is_preview:  # Only cache if not editor preview
            cache_key = get_invite_page_cache_key(slug)
            cache_check_start = time.time()
            cached_response = cache.get(cache_key)
            cache_check_time = (time.time() - cache_check_start) * 1000  # Convert to ms
            
            if cached_response:
                response_time = (time.time() - start_time) * 1000  # Convert to ms
                logger.info(
                    f"[Cache] HIT - slug: {slug}, key: {cache_key}, "
                    f"response_time: {response_time:.2f}ms, cache_check: {cache_check_time:.2f}ms"
                )
                logger.info(
                    "CACHE_METRIC",
                    extra={
                        'event_type': 'cache_hit',
                        'slug': slug,
                        'response_time_ms': response_time,
                        'cache_key': cache_key,
                        'cache_check_time_ms': cache_check_time
                    }
                )
                # Return cached response with stale-while-revalidate headers for guests
                # s-maxage=300 (5 min CDN), stale-while-revalidate=3600 (1 hour), max-age=60 (1 min browser)
                response = Response(cached_response)
                response['Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=3600, max-age=60'
                return response
            logger.info(
                f"[Cache] MISS - slug: {slug}, key: {cache_key}, "
                f"cache_check: {cache_check_time:.2f}ms"
            )
            logger.info(
                "CACHE_METRIC",
                extra={
                    'event_type': 'cache_miss',
                    'slug': slug,
                    'cache_key': cache_key,
                    'cache_check_time_ms': cache_check_time
                }
            )

        # Step 1: Try to find published invite page (most common case)
        logger.info(f"[PublicInviteViewSet.retrieve] Step 1: Looking for published invite page with slug: '{slug}'")
        try:
            invite_page = InvitePage.objects.select_related('event', 'event__host').prefetch_related(
                'event__sub_events'
            ).only(
                'id', 'slug', 'background_url', 'config', 'is_published',
                'event_id', 'created_at', 'updated_at',
                'event__id', 'event__slug', 'event__event_structure',
                'event__rsvp_mode', 'event__public_sub_events_count',
                'event__total_sub_events_count', 'event__host_id'  # host_id needed for editor check
            ).get(slug=slug, is_published=True)
            event = invite_page.event
            query_time = time.time() - query_start
            logger.info(
                f"[PublicInviteViewSet.retrieve] Step 1 SUCCESS - Found published invite page "
                f"(ID: {invite_page.id}, Event ID: {event.id}, Query time: {query_time:.3f}s)"
            )
        except InvitePage.DoesNotExist:
            query_time = time.time() - query_start
            logger.info(f"[PublicInviteViewSet.retrieve] Step 1 FAILED: Published invite page not found (Query time: {query_time:.3f}s)")

            # Step 2: Try unpublished invite page (security: do NOT auto-publish)
            query_start = time.time()
            logger.info(f"[PublicInviteViewSet.retrieve] Step 2: Looking for unpublished invite page with slug: '{slug}'")
            try:
                invite_page = InvitePage.objects.select_related('event').prefetch_related(
                    'event__sub_events'
                ).only(
                    'id', 'slug', 'background_url', 'config', 'is_published',
                    'event_id', 'created_at', 'updated_at',
                    'event__id', 'event__slug', 'event__event_structure',
                    'event__rsvp_mode', 'event__host_id'  # host_id needed for auth check
                ).get(slug=slug)
                event = invite_page.event
                query_time = time.time() - query_start
                logger.info(
                    f"[PublicInviteViewSet.retrieve] Step 2: Found invite page "
                    f"(ID: {invite_page.id}, Published: {invite_page.is_published}, Query time: {query_time:.3f}s)"
                )

                # ENHANCEMENT: Allow authenticated hosts to preview their own draft pages
                if not invite_page.is_published:
                    # Check if user is authenticated and is the event host
                    if request.user.is_authenticated and event.host == request.user:
                        # Host is previewing their own draft - allow access
                        logger.info(
                            f"[PublicInviteViewSet.retrieve] Host preview of draft page - "
                            f"User: {request.user.id}, Event: {event.id}, Slug: {slug}"
                        )
                        # Continue to return the invite page (bypass the 404 below)
                    else:
                        # Not the host or not authenticated - block access (security)
                        logger.error(
                        "INVITE_404: Unpublished invite page accessed",
                        extra={
                            'event_type': 'invite_404_unpublished',
                            'slug': slug,
                            'invite_page_id': invite_page.id,
                            'path': request.path,
                                'user_id': request.user.id if request.user.is_authenticated else None,
                        }
                    )
                    raise NotFound(f"Invite page not found for slug: {slug}")

                logger.info("[PublicInviteViewSet.retrieve] Step 2 SUCCESS - Using invite page")

            except InvitePage.DoesNotExist:
                query_time = time.time() - query_start
                logger.info(f"[PublicInviteViewSet.retrieve] Step 2 FAILED: InvitePage not found (Query time: {query_time:.3f}s)")

                # Step 3: Event not found or no invite page - return 404
                query_start = time.time()
                logger.info(f"[PublicInviteViewSet.retrieve] Step 3: Looking for event with slug: '{slug}'")
                try:
                    event = Event.objects.only(
                        'id', 'slug', 'page_config', 'event_structure', 'title',
                        'description', 'date', 'has_rsvp', 'has_registry'
                    ).get(slug=slug)

                    query_time = time.time() - query_start
                    logger.warning(
                        f"[PublicInviteViewSet.retrieve] Step 3: Event found (ID: {event.id}, Title: '{event.title}') "
                        f"but no invite page (Query time: {query_time:.3f}s)"
                    )
                except Event.DoesNotExist:
                    query_time = time.time() - query_start
                    logger.warning(f"[PublicInviteViewSet.retrieve] Step 3: Event not found for slug: '{slug}' (Query time: {query_time:.3f}s)")

                # Log 404 to CloudWatch with full request details for alerting
                full_url = request.build_absolute_uri()
                logger.error(
                    "INVITE_404: Invite page or event not found",
                    extra={
                        'event_type': 'invite_404',
                        'slug': slug,
                        'full_url': full_url,
                        'path': request.path,
                        'query_params': dict(request.query_params),
                        'user_agent': request.META.get('HTTP_USER_AGENT', ''),
                        'referer': request.META.get('HTTP_REFERER', ''),
                        'remote_addr': request.META.get('REMOTE_ADDR', ''),
                        'request_method': request.method,
                    }
                )
                raise NotFound(f"Invite page or event not found for slug: {slug}")

        # Extract guest token from query params (already extracted above for cache check)
        sub_events_start = time.time()
        # guest_token already extracted at line 665 for cache check
        guest = None
        allowed_sub_events = []

        # Optimization: Skip sub-events query for SIMPLE events without guest tokens
        if event.event_structure == 'SIMPLE' and not guest_token:
            allowed_sub_events = SubEvent.objects.none()
            sub_events_list = []
            has_sub_events = False
        else:
            if guest_token:
                # Resolve guest token with optimized query
                try:
                    guest = Guest.objects.only('id', 'name', 'event_id', 'guest_token').get(
                        guest_token=guest_token,
                        event=event,
                        is_removed=False
                    )

                    # Get allowed sub-events via join table with optimized query
                    allowed_sub_events = SubEvent.objects.filter(
                        guest_invites__guest=guest,
                        is_removed=False
                    ).only(
                        'id', 'title', 'start_at', 'end_at', 'location',
                        'description', 'image_url', 'rsvp_enabled'
                    ).order_by('start_at')

                except Guest.DoesNotExist:
                    allowed_sub_events = SubEvent.objects.none()
                    guest = None

            else:
                # Public link - only show public-visible sub-events with optimized query
                # Use cached count to avoid redundant exists() query
                if event.public_sub_events_count == 0:
                    allowed_sub_events = SubEvent.objects.none()
                else:
                    # Use prefetched sub-events if available (from prefetch_related)
                    if hasattr(event, '_prefetched_objects_cache') and 'sub_events' in event._prefetched_objects_cache:
                        # Use prefetched queryset
                        allowed_sub_events = event.sub_events.filter(
                            is_public_visible=True,
                            is_removed=False
                        ).only(
                            'id', 'title', 'start_at', 'end_at', 'location',
                            'description', 'image_url', 'rsvp_enabled'
                        ).order_by('start_at')
                    else:
                        # Fallback to separate query if prefetch didn't happen
                        allowed_sub_events = SubEvent.objects.filter(
                            event=event,
                            is_public_visible=True,
                            is_removed=False
                        ).only(
                            'id', 'title', 'start_at', 'end_at', 'location',
                            'description', 'image_url', 'rsvp_enabled'
                        ).order_by('start_at')

            # Convert to list early to evaluate queryset and check count efficiently
            sub_events_list = list(allowed_sub_events)
            has_sub_events = len(sub_events_list) > 0

        # Serialize sub-events (use list to avoid re-evaluating queryset)
        serialized_sub_events = SubEventSerializer(sub_events_list, many=True).data

        # Serialize guest context only if guest exists (avoid unnecessary serialization)
        guest_context = None
        if guest:
            guest_context = GuestSerializer(guest).data
        
        # Process description tiles with guest variables if guest token is provided
        if guest and invite_page.config and 'tiles' in invite_page.config:
            from .utils import render_description_with_guest
            
            base_url = request.build_absolute_uri('/').rstrip('/')
            for tile in invite_page.config['tiles']:
                if tile.get('type') == 'description' and tile.get('settings', {}).get('content'):
                    original_content = tile['settings']['content']
                    rendered_content, warnings = render_description_with_guest(
                        original_content,
                        event,
                        guest,
                        base_url=base_url
                    )
                    tile['settings']['content'] = rendered_content
                    # Optionally log warnings for debugging
                    if warnings.get('unresolved_variables'):
                        logger.debug(
                            f"[PublicInviteViewSet] Unresolved variables in description: {warnings['unresolved_variables']}"
                        )

        # Serialize with context
        serializer = self.get_serializer(
            invite_page,
            context={
                'allowed_sub_events': serialized_sub_events,
                'guest_context': guest_context
            }
        )

        elapsed_time = time.time() - start_time
        sub_events_total_time = time.time() - sub_events_start

        # Log timing for slow requests (important for debugging 504s)
        if elapsed_time > 1.0:
            logger.warning(
                f"[PublicInviteViewSet] SLOW REQUEST: {elapsed_time:.2f}s "
                f"(sub-events: {sub_events_total_time:.2f}s) for slug: {slug}"
            )

        # Determine if this is an editor preview (authenticated host with preview parameter)
        is_event_host = False
        if event and request.user.is_authenticated:
            is_event_host = event.host == request.user
        
        # Always bypass cache for preview mode (regardless of authentication)
        # Preview mode is meant to show latest changes, so never use cache
        bypass_cache = is_preview

        # Create response
        response = Response(serializer.data)
        
        # Set cache headers based on request type
        if bypass_cache:
            # Editor preview: No cache, always fresh
            response['Cache-Control'] = 'no-cache, no-store, must-revalidate, private'
            response['Pragma'] = 'no-cache'
            response['Expires'] = '0'
            logger.info(
                f"[Cache] BYPASS - Editor preview for slug: {slug}, "
                f"user: {request.user.id if request.user.is_authenticated else 'anonymous'}"
            )
        else:
            # Guest/public: Use stale-while-revalidate with optimized TTL
            # s-maxage=300 (5 min CDN), stale-while-revalidate=3600 (1 hour), max-age=60 (1 min browser)
            response['Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=3600, max-age=60'
            logger.info(
                f"[Cache] SET - Guest/public request for slug: {slug}, "
                f"cache_control: stale-while-revalidate"
            )

        # Cache response for published pages without guest tokens AND not editor preview
        if invite_page.is_published and not guest_token and not bypass_cache:
            cache_key = get_invite_page_cache_key(slug)
            cache.set(cache_key, serializer.data, 60)  # 1 minute TTL
            logger.info(
                f"[Cache] SET - slug: {slug}, key: {cache_key}, ttl: 300s, "
                f"response_time: {elapsed_time:.3f}s"
            )
            logger.info(
                "CACHE_METRIC",
                extra={
                    'event_type': 'cache_set',
                    'slug': slug,
                    'cache_key': cache_key,
                    'ttl_seconds': 300,
                    'response_time_ms': elapsed_time * 1000
                }
            )

        return response

    @action(detail=True, methods=['get'], url_path='guests.csv')
    def guests_csv(self, request, id=None):
        """Export guest list (RSVPs) as CSV - host only, privacy protected"""
        event = self.get_object()
        self._verify_event_ownership(event)  # Explicit ownership check

        # Get all RSVPs for this event
        rsvps = RSVP.objects.filter(event=event).order_by('-created_at')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="guest_list_{event.slug}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Name',
            'Phone',
            'Email',
            'Will Attend',
            'Guests Count',
            'Source Channel',
            'Notes',
            'RSVP Date',
            'Is Removed'
        ])

        for rsvp in rsvps:
            writer.writerow([
                rsvp.name,
                rsvp.phone,
                rsvp.email or '',
                rsvp.get_will_attend_display(),
                rsvp.guests_count,
                rsvp.get_source_channel_display(),
                rsvp.notes or '',
                rsvp.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'Yes' if rsvp.is_removed else 'No',
            ])

        return response


class PublicEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public registry view - no authentication required

    PRIVACY NOTE: This viewset only exposes:
    - Public event details (title, date, city, slug)
    - Active registry items (no guest list, no RSVPs, no orders)
    - No host information beyond what's in EventSerializer

    All private data (guest lists, RSVPs, orders) is ONLY accessible to the event host
    through EventViewSet with authentication.
    """
    serializer_class = EventSerializer
    permission_classes = [AllowAny]
    lookup_field = 'slug'

    def get_queryset(self):
        """Return all events - privacy is enforced per-endpoint"""
        # Use select_related to avoid N+1 queries when accessing host.name
        return Event.objects.select_related('host').all()

    def retrieve(self, request, *args, **kwargs):
        """Override retrieve to normalize slug to lowercase before lookup"""
        import logging
        logger = logging.getLogger(__name__)

        original_slug = kwargs.get('slug', '')
        logger.info(
            f"[PublicEventViewSet.retrieve] Request received - Original slug: '{original_slug}'"
        )

        normalized_slug = original_slug.lower() if original_slug else ''
        if 'slug' in kwargs:
            kwargs['slug'] = normalized_slug
            if original_slug != normalized_slug:
                logger.info(
                    f"[PublicEventViewSet.retrieve] Slug normalized: '{original_slug}' -> '{normalized_slug}'"
                )

        try:
            result = super().retrieve(request, *args, **kwargs)
            logger.info(
                f"[PublicEventViewSet.retrieve] Success - Slug: '{normalized_slug}', "
                f"Status: {result.status_code}"
            )
            return result
        except Exception as e:
            logger.error(
                f"[PublicEventViewSet.retrieve] Error - Slug: '{normalized_slug}', Error: {str(e)}",
                exc_info=True
            )
            raise

    @action(detail=True, methods=['get'])
    def items(self, request, slug=None):
        """Get active items for public registry - no private data exposed"""
        import logging
        logger = logging.getLogger(__name__)

        original_slug = slug
        logger.info(
            f"[PublicEventViewSet.items] Request received - Original slug: '{original_slug}'"
        )

        if slug:
            normalized_slug = slug.lower()
            if original_slug != normalized_slug:
                logger.info(
                    f"[PublicEventViewSet.items] Slug normalized: '{original_slug}' -> '{normalized_slug}'"
                )
            slug = normalized_slug
        else:
            logger.warning("[PublicEventViewSet.items] No slug provided in request")
            normalized_slug = None

        try:
            logger.info(
                f"[PublicEventViewSet.items] Querying database for slug: '{normalized_slug}'"
            )
            event = get_object_or_404(Event, slug=slug)
            logger.info(
                f"[PublicEventViewSet.items] Event found - ID: {event.id}, "
                f"Title: '{event.title}', Slug: '{event.slug}', "
                f"HasRegistry: {event.has_registry}, IsPublic: {event.is_public}"
            )
        except Exception as e:
            logger.error(
                f"[PublicEventViewSet.items] Database query failed - Slug: '{normalized_slug}', "
                f"Error: {str(e)}",
                exc_info=True
            )
            raise

        # For private events, verify user is in guest list
        if not event.is_public:
            phone = request.query_params.get('phone', '').strip()
            if not phone:
                return Response(
                    {'error': 'This is a private event. Phone number required to verify access.'},
                    status=status.HTTP_403_FORBIDDEN
                )

            event_country_code = get_country_code(event.country)
            if not phone.startswith('+'):
                country_code = request.query_params.get('country_code', event_country_code)
                phone = format_phone_with_country_code(phone, country_code)

            guest = None
            phone_digits_only = re.sub(r'\D', '', phone)
            provided_country_code = request.query_params.get('country_code', event_country_code)

            guest = Guest.objects.filter(event=event, phone=phone).first()

            if not guest:
                all_guests = Guest.objects.filter(event=event)
                for g in all_guests:
                    guest_phone_digits = re.sub(r'\D', '', g.phone)

                    if guest_phone_digits == phone_digits_only:
                        guest = g
                        break

                    if len(phone_digits_only) >= 10 and len(guest_phone_digits) >= 10:
                        local_number = phone_digits_only[-10:]
                        if guest_phone_digits.endswith(local_number):
                            stored_country_code, _ = parse_phone_number(g.phone)
                            if stored_country_code == provided_country_code:
                                guest = g
                                break

            if not guest:
                return Response(
                    {'error': 'This is a private event. Only invited guests can view the registry.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        if not event.has_registry:
            logger.warning(
                f"[PublicEventViewSet.items] Registry disabled for event ID: {event.id}, "
                f"Slug: '{event.slug}'"
            )
            return Response(
                {'error': 'Gift registry is not available for this event'},
                status=status.HTTP_403_FORBIDDEN
            )

        logger.info(
            f"[PublicEventViewSet.items] Fetching active items for event ID: {event.id}"
        )
        items = RegistryItem.objects.filter(
            event=event,
            status='active'
        ).order_by('priority_rank', 'name')

        items_data = []
        for item in items:
            remaining = item.qty_total - item.qty_purchased
            item_dict = RegistryItemSerializer(item).data
            item_dict['remaining'] = remaining
            items_data.append(item_dict)

        response_data = {
            'event': EventSerializer(event).data,
            'items': items_data,
        }

        logger.info(
            f"[PublicEventViewSet.items] Success - Event ID: {event.id}, "
            f"Items returned: {len(items_data)}"
        )
        return Response(response_data)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_rsvp(request, event_id):
    """Get existing RSVP by phone number (public endpoint)"""
    try:
        event = get_object_or_404(Event, id=event_id)
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if RSVP is enabled for this event
    if not event.has_rsvp:
        return Response(
            {'error': 'RSVP is not available for this event'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    phone = request.query_params.get('phone', '').strip()
    if not phone:
        return Response({'error': 'Phone number is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Format phone with country code if not already formatted
    event_country_code = get_country_code(event.country)
    original_phone = phone
    if phone and not phone.startswith('+'):
        country_code = request.query_params.get('country_code', event_country_code)
        phone = format_phone_with_country_code(phone, country_code)
    
    # Find existing RSVP - try multiple formats (grandfather clause: check RSVP first)
    existing_rsvp = RSVP.objects.filter(event=event, phone=phone, is_removed=False).first()
    
    # If not found with formatted phone, try variations
    if not existing_rsvp:
        # Try without + prefix
        phone_without_plus = phone.lstrip('+')
        existing_rsvp = RSVP.objects.filter(event=event, phone=phone_without_plus, is_removed=False).first()
        
        # Try with different country code formats (if provided country code doesn't match)
        if not existing_rsvp:
            provided_country_code = request.query_params.get('country_code', event_country_code)
            phone_digits_only = re.sub(r'\D', '', phone)
            
            # Try all RSVPs and check if the phone digits match (ignoring formatting, exclude removed)
            all_rsvps = RSVP.objects.filter(event=event, is_removed=False)
            for rsvp in all_rsvps:
                rsvp_phone_digits = re.sub(r'\D', '', rsvp.phone)
                
                # Check if phone digits match exactly
                if rsvp_phone_digits == phone_digits_only:
                    existing_rsvp = rsvp
                    break
                
                # If digits don't match exactly, try matching last 10 digits with country code verification
                if len(phone_digits_only) >= 10 and len(rsvp_phone_digits) >= 10:
                    local_number = phone_digits_only[-10:]
                    if rsvp_phone_digits.endswith(local_number):
                        # Extract country code from stored phone
                        stored_country_code, _ = parse_phone_number(rsvp.phone)
                        # Only match if country codes are the same
                        if stored_country_code == provided_country_code:
                            existing_rsvp = rsvp
                            break
    
    if existing_rsvp:
        # Check if linked guest is removed (block access)
        if existing_rsvp.guest and existing_rsvp.guest.is_removed:
            return Response(
                {'error': 'This guest has been removed. You cannot access your RSVP.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Return RSVP data (grandfather clause: existing RSVP allows access)
        rsvp_data = RSVPSerializer(existing_rsvp).data
        rsvp_data['found_in'] = 'rsvp'
        return Response(rsvp_data, status=status.HTTP_200_OK)
    else:
        # For both public and private events, check guest list if RSVP not found (exclude removed guests)
        phone_digits_only = re.sub(r'\D', '', phone)
        provided_country_code = request.query_params.get('country_code', event_country_code)
        
        # Try to find in guest list (exclude removed guests)
        guest = None
        # First try exact phone match
        guest = Guest.objects.filter(event=event, phone=phone, is_removed=False).first()
        
        # If not found, try matching by digits only
        if not guest:
            all_guests = Guest.objects.filter(event=event, is_removed=False)
            for g in all_guests:
                guest_phone_digits = re.sub(r'\D', '', g.phone)
                if guest_phone_digits == phone_digits_only:
                    guest = g
                    break
                
                # Try matching last 10 digits with country code verification
                if len(phone_digits_only) >= 10 and len(guest_phone_digits) >= 10:
                    local_number = phone_digits_only[-10:]
                    if guest_phone_digits.endswith(local_number):
                        stored_country_code, _ = parse_phone_number(g.phone)
                        if stored_country_code == provided_country_code:
                            guest = g
                            break
        
        if guest:
            # Found in guest list but no RSVP - return guest info
            guest_data = GuestSerializer(guest).data
            guest_data['found_in'] = 'guest_list'
            guest_data['has_rsvp'] = False
            return Response(guest_data, status=status.HTTP_200_OK)
        
        # Not found in RSVP or guest list
        # SECURITY FIX: Do NOT expose PII (phone numbers) in debug responses
        # Even with DEBUG=True, this violates privacy regulations
        # Debug information should only be available through authenticated admin endpoints
        return Response({
            'error': 'No RSVP or guest found for this phone number'
        }, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
def check_phone_for_rsvp(request, event_id):
    """Stage 0: Check if phone number exists in guest list for private events"""
    try:
        event = get_object_or_404(Event, id=event_id)
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if RSVP is enabled for this event
    if not event.has_rsvp:
        return Response({'error': 'RSVP is not enabled for this event'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Only required for private events
    if event.is_public:
        return Response({'error': 'This endpoint is only for private events'}, status=status.HTTP_400_BAD_REQUEST)
    
    phone = request.data.get('phone', '').strip()
    country_code = request.data.get('country_code', '')
    
    if not phone:
        return Response({'error': 'Phone number is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Format phone with country code
    from .utils import format_phone_with_country_code, get_country_code, parse_phone_number
    event_country_code = get_country_code(event.country)
    original_phone = phone
    
    if phone and not phone.startswith('+'):
        if country_code:
            phone = format_phone_with_country_code(phone, country_code)
        else:
            phone = format_phone_with_country_code(phone, event_country_code)
    
    phone_digits_only = re.sub(r'\D', '', phone)
    provided_country_code = country_code or event_country_code
    
    # GRANDFATHER CLAUSE: First check if there's an existing RSVP (even if not in guest list)
    # This handles people who RSVP'd when event was public but later became private
    existing_rsvp = None
    # Try exact phone match first
    existing_rsvp = RSVP.objects.filter(event=event, phone=phone, is_removed=False).first()
    
    # If not found, try matching by digits only
    if not existing_rsvp:
        all_rsvps = RSVP.objects.filter(event=event, is_removed=False)
        for rsvp in all_rsvps:
            rsvp_phone_digits = re.sub(r'\D', '', rsvp.phone)
            if rsvp_phone_digits == phone_digits_only:
                existing_rsvp = rsvp
                break
            
            # Try matching last 10 digits with country code verification
            if len(phone_digits_only) >= 10 and len(rsvp_phone_digits) >= 10:
                local_number = phone_digits_only[-10:]
                if rsvp_phone_digits.endswith(local_number):
                    stored_country_code, _ = parse_phone_number(rsvp.phone)
                    if stored_country_code == provided_country_code:
                        existing_rsvp = rsvp
                        break
    
    # If existing RSVP found (grandfather clause), return RSVP data
    if existing_rsvp:
        # Check if linked guest is removed (block access)
        if existing_rsvp.guest and existing_rsvp.guest.is_removed:
            return Response(
                {'error': 'This guest has been removed. You cannot access your RSVP.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Return RSVP data for pre-filling form
        from .serializers import RSVPSerializer
        rsvp_data = RSVPSerializer(existing_rsvp).data
        rsvp_data['found_in'] = 'rsvp'
        rsvp_data['phone_verified'] = True
        return Response(rsvp_data, status=status.HTTP_200_OK)
    
    # If no existing RSVP, check guest list (exclude removed guests)
    guest = None
    # First try exact phone match
    guest = Guest.objects.filter(event=event, phone=phone, is_removed=False).first()
    
    # If not found, try matching by digits only
    if not guest:
        all_guests = Guest.objects.filter(event=event, is_removed=False)
        for g in all_guests:
            guest_phone_digits = re.sub(r'\D', '', g.phone)
            if guest_phone_digits == phone_digits_only:
                guest = g
                break
            
            # Try matching last 10 digits with country code verification
            if len(phone_digits_only) >= 10 and len(guest_phone_digits) >= 10:
                local_number = phone_digits_only[-10:]
                if guest_phone_digits.endswith(local_number):
                    stored_country_code, _ = parse_phone_number(g.phone)
                    if stored_country_code == provided_country_code:
                        guest = g
                        break
    
    if not guest:
        return Response(
            {'error': 'Phone number not found. Please try a different number or contact the host.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Return guest data for pre-filling form
    from .serializers import GuestSerializer
    guest_data = GuestSerializer(guest).data
    guest_data['found_in'] = 'guest_list'
    guest_data['phone_verified'] = True
    
    return Response(guest_data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_guest_by_token(request, event_id):
    """Get guest data by token for RSVP autofill (public endpoint)"""
    try:
        event = get_object_or_404(Event, id=event_id)
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if RSVP is enabled for this event
    if not event.has_rsvp:
        return Response({'error': 'RSVP is not enabled for this event'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Extract token from query parameters (support both 'token' and 'g' for compatibility)
    guest_token = request.query_params.get('token', '').strip() or request.query_params.get('g', '').strip()
    
    if not guest_token:
        return Response({'error': 'Guest token is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        guest = Guest.objects.get(
            guest_token=guest_token,
            event=event,
            is_removed=False
        )
        
        # Check if guest is removed (shouldn't happen due to filter, but double-check)
        if guest.is_removed:
            return Response(
                {'error': 'This guest has been removed. You cannot access your RSVP.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Return guest data in same format as check_phone_for_rsvp response
        from .utils import parse_phone_number
        country_code, local_number = parse_phone_number(guest.phone)
        
        guest_data = {
            'name': guest.name,
            'phone': guest.phone,
            'email': guest.email or '',
            'country_code': country_code,
            'local_number': local_number,
            'found_in': 'guest_list',
            'has_rsvp': False,
            'phone_verified': True,
        }
        
        return Response(guest_data, status=status.HTTP_200_OK)
    except Guest.DoesNotExist:
        return Response({'error': 'Invalid guest token'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
def create_rsvp(request, event_id):
    """Create or update RSVP for an event (public endpoint)"""
    try:
        event = get_object_or_404(Event, id=event_id)
    except Event.DoesNotExist:
        return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
    
    # Check if RSVP is enabled for this event
    if not event.has_rsvp:
        return Response(
            {'error': 'RSVP is not available for this event'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    serializer = RSVPCreateSerializer(data=request.data)
    if serializer.is_valid():
        phone = serializer.validated_data['phone']
        name = serializer.validated_data['name']
        
        # Format phone with country code if not already formatted
        event_country_code = get_country_code(event.country)
        if phone and not phone.startswith('+'):
            country_code = request.data.get('country_code') or event_country_code
            phone = format_phone_with_country_code(phone, country_code)
        
        # Check if RSVP already exists for this phone FIRST (grandfather clause)
        existing_rsvp = RSVP.objects.filter(event=event, phone=phone, is_removed=False).first()
        
        # For private events, check existing RSVP first (grandfather clause)
        if not event.is_public:
            if existing_rsvp:
                # Existing RSVP found - check if linked guest is removed
                if existing_rsvp.guest and existing_rsvp.guest.is_removed:
                    return Response(
                        {'error': 'This guest has been removed. You cannot update your RSVP.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                # If not removed, proceed to update existing RSVP (grandfather clause allows access)
                guest = existing_rsvp.guest  # Use existing guest link
            else:
                # No existing RSVP, check guest list (exclude removed guests)
                phone_digits_only = re.sub(r'\D', '', phone)
                provided_country_code = request.data.get('country_code') or event_country_code
                
                # Try to find in guest list (exclude removed guests)
                guest = None
                # First try exact phone match
                guest = Guest.objects.filter(event=event, phone=phone, is_removed=False).first()
                
                # If not found, try matching by digits only
                if not guest:
                    all_guests = Guest.objects.filter(event=event, is_removed=False)
                    for g in all_guests:
                        guest_phone_digits = re.sub(r'\D', '', g.phone)
                        if guest_phone_digits == phone_digits_only:
                            guest = g
                            break
                        
                        # Try matching last 10 digits with country code verification
                        if len(phone_digits_only) >= 10 and len(guest_phone_digits) >= 10:
                            local_number = phone_digits_only[-10:]
                            if guest_phone_digits.endswith(local_number):
                                stored_country_code, _ = parse_phone_number(g.phone)
                                if stored_country_code == provided_country_code:
                                    guest = g
                                    break
            
            if not guest:
                return Response(
                    {'error': 'This is a private event. Only invited guests can RSVP.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            # For public events, check existing RSVP first (grandfather clause)
            if existing_rsvp:
                # Existing RSVP found - check if linked guest is removed
                if existing_rsvp.guest and existing_rsvp.guest.is_removed:
                    return Response(
                        {'error': 'This guest has been removed. You cannot update your RSVP.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                # If not removed, proceed to update existing RSVP
                guest = existing_rsvp.guest  # Use existing guest link
            else:
                # For public events, try to match guest (optional linking, exclude removed)
                guest = None
                if event.guest_list.exists():
                    # Try to match by phone first, then by name (exclude removed)
                    guest = Guest.objects.filter(event=event, phone=phone, is_removed=False).first()
                    if not guest:
                        guest = Guest.objects.filter(event=event, name__iexact=name, is_removed=False).first()
        
        # Update phone in validated_data and remove country_code (not a model field)
        serializer.validated_data['phone'] = phone
        selected_sub_event_ids = serializer.validated_data.pop('selectedSubEventIds', [])
        rsvp_data = {k: v for k, v in serializer.validated_data.items() if k not in ['country_code', 'selectedSubEventIds']}
        
        # Handle ENVELOPE events with sub-events
        if event.event_structure == 'ENVELOPE':
            if event.rsvp_mode == 'PER_SUBEVENT':
                # PER_SUBEVENT mode: Create/update RSVP for each selected sub-event
                if not selected_sub_event_ids:
                    return Response(
                        {'error': 'selectedSubEventIds is required for PER_SUBEVENT mode'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Verify all sub-events belong to this event and are not removed
                sub_events = SubEvent.objects.filter(
                    id__in=selected_sub_event_ids,
                    event=event,
                    is_removed=False,
                    rsvp_enabled=True
                )
                
                if sub_events.count() != len(selected_sub_event_ids):
                    return Response(
                        {'error': 'Some sub-events not found, disabled, or do not belong to this event'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # For private events, verify guest has access to these sub-events
                if not event.is_public and guest:
                    allowed_sub_event_ids = set(
                        GuestSubEventInvite.objects.filter(guest=guest)
                        .values_list('sub_event_id', flat=True)
                    )
                    if not all(se_id in allowed_sub_event_ids for se_id in selected_sub_event_ids):
                        return Response(
                            {'error': 'You are not invited to some of the selected sub-events'},
                            status=status.HTTP_403_FORBIDDEN
                        )
                
                # Create/update RSVP for each sub-event
                created_rsvps = []
                any_new_rsvp_created = False
                for sub_event in sub_events:
                    # Check if RSVP already exists for this sub-event
                    existing_sub_rsvp = RSVP.objects.filter(
                        event=event,
                        phone=phone,
                        sub_event=sub_event,
                        is_removed=False
                    ).first()
                    
                    if existing_sub_rsvp:
                        # Update existing RSVP
                        for key, value in rsvp_data.items():
                            setattr(existing_sub_rsvp, key, value)
                        if guest:
                            existing_sub_rsvp.guest = guest
                        existing_sub_rsvp.save()
                        created_rsvps.append(existing_sub_rsvp)
                    else:
                        # Create new RSVP
                        rsvp = RSVP.objects.create(
                            event=event,
                            sub_event=sub_event,
                            guest=guest,
                            **rsvp_data
                        )
                        created_rsvps.append(rsvp)
                        any_new_rsvp_created = True
                
                # Return all created/updated RSVPs
                # Status code based on whether any new RSVP rows were created
                return Response(
                    RSVPSerializer(created_rsvps, many=True).data,
                    status=status.HTTP_201_CREATED if any_new_rsvp_created else status.HTTP_200_OK
                )
            
            elif event.rsvp_mode == 'ONE_TAP_ALL':
                # ONE_TAP_ALL mode: Create RSVP for all allowed sub-events
                # Get allowed sub-events for this guest
                if guest:
                    allowed_sub_events = SubEvent.objects.filter(
                        guest_invites__guest=guest,
                        is_removed=False,
                        rsvp_enabled=True
                    )
                else:
                    # Public event - get all public-visible sub-events
                    allowed_sub_events = SubEvent.objects.filter(
                        event=event,
                        is_public_visible=True,
                        is_removed=False,
                        rsvp_enabled=True
                    )
                
                if not allowed_sub_events.exists():
                    return Response(
                        {'error': 'No sub-events available for RSVP'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Create/update RSVP for each allowed sub-event
                created_rsvps = []
                any_new_rsvp_created = False
                for sub_event in allowed_sub_events:
                    # Check if RSVP already exists for this sub-event
                    existing_sub_rsvp = RSVP.objects.filter(
                        event=event,
                        phone=phone,
                        sub_event=sub_event,
                        is_removed=False
                    ).first()
                    
                    if existing_sub_rsvp:
                        # Update existing RSVP
                        for key, value in rsvp_data.items():
                            setattr(existing_sub_rsvp, key, value)
                        if guest:
                            existing_sub_rsvp.guest = guest
                        existing_sub_rsvp.save()
                        created_rsvps.append(existing_sub_rsvp)
                    else:
                        # Create new RSVP
                        rsvp = RSVP.objects.create(
                            event=event,
                            sub_event=sub_event,
                            guest=guest,
                            **rsvp_data
                        )
                        created_rsvps.append(rsvp)
                        any_new_rsvp_created = True
                
                # Return all created/updated RSVPs
                # Status code based on whether any new RSVP rows were created
                return Response(
                    RSVPSerializer(created_rsvps, many=True).data,
                    status=status.HTTP_201_CREATED if any_new_rsvp_created else status.HTTP_200_OK
                )
        
        # SIMPLE event: Keep existing behavior (sub_event = NULL)
        if existing_rsvp:
            # Check if RSVP itself is removed (shouldn't happen due to filter, but double-check)
            if existing_rsvp.is_removed:
                return Response(
                    {'error': 'This RSVP has been removed. You cannot update it.'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Update existing RSVP
            for key, value in rsvp_data.items():
                setattr(existing_rsvp, key, value)
            if guest:
                existing_rsvp.guest = guest
            existing_rsvp.save()
            return Response(RSVPSerializer(existing_rsvp).data, status=status.HTTP_200_OK)
        else:
            # Create new RSVP (sub_event will be NULL for SIMPLE events)
            rsvp = RSVP.objects.create(event=event, guest=guest, **rsvp_data)
            return Response(RSVPSerializer(rsvp).data, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_image(request, event_id):
    """
    Upload an image file to S3 and return the public URL
    
    Accepts: multipart/form-data with 'image' field
    URL: /api/events/{event_id}/upload-image/
    Returns: { 'url': 'https://...' }
    """
    # Validate event_id is an integer
    try:
        event_id = int(event_id)
    except (ValueError, TypeError):
        return Response(
            {'error': 'Invalid event_id. Must be an integer.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get event and validate ownership
    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return Response(
            {'error': 'Event not found.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Verify user owns the event
    if event.host != request.user:
        return Response(
            {'error': 'You do not have permission to upload images to this event.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    if 'image' not in request.FILES:
        return Response(
            {'error': 'No image file provided. Please include an image file in the request.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    image_file = request.FILES['image']
    
    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB
    if image_file.size > max_size:
        return Response(
            {'error': f'Image file is too large. Maximum size is 5MB, but received {image_file.size / 1024 / 1024:.2f}MB.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if image_file.content_type not in allowed_types:
        return Response(
            {'error': f'Invalid file type. Allowed types: {", ".join(allowed_types)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Upload to S3 or local storage with event_id
        uploaded_url = upload_to_s3(image_file, event_id=event_id)
        
        # If in DEBUG mode and URL is relative, make it absolute
        if settings.DEBUG and uploaded_url.startswith('/'):
            # Construct full URL using request
            scheme = request.scheme
            host = request.get_host()
            full_url = f"{scheme}://{host}{uploaded_url}"
            uploaded_url = full_url
        
        return Response(
            {'url': uploaded_url},
            status=status.HTTP_200_OK
        )
    except Exception as e:
        # Log the actual error for debugging
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Image upload failed for event {event_id}: {str(e)}', exc_info=True)
        
        return Response(
            {'error': f'Failed to upload image: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class SubEventViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for sub-events - host only, privacy protected
    """
    serializer_class = SubEventSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Hosts can only see sub-events for their own events"""
        queryset = SubEvent.objects.filter(event__host=self.request.user, is_removed=False)
        
        # Filter by event_id if provided in URL kwargs (for /envelopes/<event_id>/sub-events/ endpoint)
        event_id = self.kwargs.get('event_id')
        if event_id:
            # Verify the event belongs to the user
            try:
                event = Event.objects.get(id=event_id, host=self.request.user)
                queryset = queryset.filter(event=event)
            except Event.DoesNotExist:
                from rest_framework.exceptions import NotFound
                raise NotFound("Event not found or you don't have permission to access it.")
        
        return queryset.order_by('start_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return SubEventCreateSerializer
        return SubEventSerializer
    
    def get_object(self):
        """Override to ensure host can only access their own sub-events"""
        obj = super().get_object()
        if obj.event.host != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access sub-events for your own events.")
        return obj
    
    def perform_create(self, serializer):
        """Ensure sub-event is created for an event owned by the user"""
        event_id = self.kwargs.get('event_id')
        if not event_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("event_id is required")
        
        event = get_object_or_404(Event, id=event_id, host=self.request.user)
        
        # Upgrade event to ENVELOPE if needed
        event.upgrade_to_envelope_if_needed()
        
        sub_event = serializer.save(event=event)
        
        # If rsvp_mode is PER_SUBEVENT, ensure event is ENVELOPE
        if event.rsvp_mode == 'PER_SUBEVENT':
            event.event_structure = 'ENVELOPE'
            event.save(update_fields=['event_structure', 'updated_at'])
        
        return sub_event
    
    def create(self, request, *args, **kwargs):
        """Create sub-event for an event"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sub_event = self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(SubEventSerializer(sub_event).data, status=status.HTTP_201_CREATED, headers=headers)
    
    def perform_destroy(self, instance):
        """Soft delete sub-event"""
        instance.is_removed = True
        instance.save(update_fields=['is_removed', 'updated_at'])


class GuestInviteViewSet(viewsets.ModelViewSet):
    """
    Manage guest sub-event assignments - host only, privacy protected
    """
    serializer_class = GuestSubEventInviteSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Hosts can only see guest invites for their own events"""
        return GuestSubEventInvite.objects.filter(
            guest__event__host=self.request.user
        )
    
    def get_object(self):
        """Override to ensure host can only access their own guest invites"""
        obj = super().get_object()
        if obj.guest.event.host != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access guest invites for your own events.")
        return obj
    
    @action(detail=False, methods=['get'], url_path='event/(?P<event_id>[^/.]+)')
    def by_event(self, request, event_id=None):
        """Get all guest invites for an event"""
        event = get_object_or_404(Event, id=event_id, host=request.user)
        
        # Get all guests with their sub-event assignments
        guests = Guest.objects.filter(event=event, is_removed=False)
        result = []
        
        for guest in guests:
            invites = GuestSubEventInvite.objects.filter(guest=guest)
            result.append({
                'guest': GuestSerializer(guest).data,
                'sub_event_ids': list(invites.values_list('sub_event_id', flat=True))
            })
        
        return Response(result)
    
    @action(detail=False, methods=['put'], url_path='guest/(?P<guest_id>[^/.]+)')
    def update_guest_invites(self, request, guest_id=None):
        """Update sub-event assignments for a guest"""
        guest = get_object_or_404(Guest, id=guest_id, event__host=request.user)
        
        # Verify ownership
        if guest.event.host != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only update guest invites for your own events.")
        
        # Get sub_event_ids from request
        sub_event_ids = request.data.get('sub_event_ids', [])
        if not isinstance(sub_event_ids, list):
            return Response(
                {'error': 'sub_event_ids must be a list'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify all sub-events belong to the same event
        sub_events = SubEvent.objects.filter(
            id__in=sub_event_ids,
            event=guest.event,
            is_removed=False
        )
        
        if sub_events.count() != len(sub_event_ids):
            return Response(
                {'error': 'Some sub-events not found or do not belong to this event'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Upgrade event to ENVELOPE if needed
        guest.event.upgrade_to_envelope_if_needed()
        
        # Remove existing invites
        GuestSubEventInvite.objects.filter(guest=guest).delete()
        
        # Create new invites
        for sub_event in sub_events:
            GuestSubEventInvite.objects.get_or_create(
                guest=guest,
                sub_event=sub_event
            )
        
        # Generate guest token if not present (always ensure token exists when sub-events are assigned)
        # Only generate token if we have sub-events assigned
        if len(sub_event_ids) > 0:
            guest.generate_guest_token()
            # Refresh guest from database to ensure we have latest data including token
            # This ensures the token is persisted and we have the latest guest data
            guest.refresh_from_db()
        
        # Get updated sub-event IDs from database to ensure accuracy
        updated_sub_event_ids = list(GuestSubEventInvite.objects.filter(guest=guest).values_list('sub_event_id', flat=True))
        
        # Return updated guest data with refreshed information
        return Response({
            'guest': GuestSerializer(guest).data,
            'sub_event_ids': updated_sub_event_ids
        })


class MessageTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for managing WhatsApp templates per event"""
    serializer_class = MessageTemplateSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Filter templates by event and verify event ownership"""
        # Start with all templates owned by the user (allows detail operations without event_id)
        queryset = MessageTemplate.objects.filter(event__host=self.request.user)
        
        # Filter by event_id if provided in URL kwargs (for nested list/create routes)
        event_id = self.kwargs.get('event_id') or self.request.query_params.get('event_id') or self.request.data.get('event_id')
        
        if event_id:
            # Verify the event belongs to the user and filter
            try:
                event = Event.objects.get(id=event_id, host=self.request.user)
                queryset = queryset.filter(event=event)
            except Event.DoesNotExist:
                return MessageTemplate.objects.none()
        
        return queryset
    
    def get_object(self):
        """Override to verify event ownership"""
        obj = super().get_object()
        # Verify the event belongs to the user
        if obj.event.host != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access templates for your own events.")
        return obj
    
    def perform_create(self, serializer):
        """Ensure template is created with valid event owned by user"""
        # Get event_id from URL kwargs (for nested routes) or request data
        event_id = self.kwargs.get('event_id') or self.request.data.get('event')
        if not event_id:
            raise drf_serializers.ValidationError({'event': 'Event ID is required.'})
        
        try:
            event = Event.objects.get(id=event_id, host=self.request.user)
        except Event.DoesNotExist:
            raise drf_serializers.ValidationError({'event': 'Event not found or you do not have permission.'})
        
        # Check for duplicate name
        if MessageTemplate.objects.filter(event=event, name=serializer.validated_data['name']).exists():
            raise drf_serializers.ValidationError({'name': 'A template with this name already exists for this event.'})
        
        # Set created_by
        serializer.save(event=event, created_by=self.request.user)
        
        # Handle is_default flag
        if serializer.validated_data.get('is_default', False):
            # Unset other defaults for this event
            MessageTemplate.objects.filter(event=event, is_default=True).exclude(id=serializer.instance.id).update(is_default=False)
    
    def perform_update(self, serializer):
        """Ensure template update maintains event ownership"""
        event_id = serializer.validated_data.get('event') or self.get_object().event.id
        
        try:
            event = Event.objects.get(id=event_id, host=self.request.user)
        except Event.DoesNotExist:
            raise drf_serializers.ValidationError({'event': 'Event not found or you do not have permission.'})
        
        # Check for duplicate name (excluding current template)
        # Use existing template.name if name not provided in PATCH request
        template = self.get_object()
        template_name = serializer.validated_data.get('name') or template.name
        if MessageTemplate.objects.filter(event=event, name=template_name).exclude(id=template.id).exists():
            raise drf_serializers.ValidationError({'name': 'A template with this name already exists for this event.'})
        
        serializer.save()
        
        # Handle is_default flag
        if serializer.validated_data.get('is_default', False):
            # Unset other defaults for this event
            MessageTemplate.objects.filter(event=event, is_default=True).exclude(id=template.id).update(is_default=False)
    
    @action(detail=True, methods=['post'])
    def preview(self, request, id=None):
        """Generate preview with sample data"""
        template = self.get_object()
        sample_data = request.data.get('sample_data', {})
        preview_text = template.get_preview(sample_data)
        return Response({
            'preview': preview_text,
            'template': MessageTemplateSerializer(template).data
        })
    
    @action(detail=True, methods=['post'])
    def duplicate(self, request, id=None):
        """Create a copy of this template"""
        template = self.get_object()
        new_name = request.data.get('name') or f"{template.name} (Copy)"
        
        # Check if name already exists
        if MessageTemplate.objects.filter(event=template.event, name=new_name).exists():
            return Response(
                {'error': f'A template with the name "{new_name}" already exists for this event.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        new_template = MessageTemplate.objects.create(
            event=template.event,
            name=new_name,
            message_type=template.message_type,
            template_text=template.template_text,
            description=template.description,
            is_active=True,
            usage_count=0,
            last_used_at=None
        )
        
        return Response(
            MessageTemplateSerializer(new_template).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=True, methods=['post'])
    def archive(self, request, id=None):
        """Archive template (set is_active=False)"""
        template = self.get_object()
        template.is_active = False
        template.save(update_fields=['is_active'])
        return Response(MessageTemplateSerializer(template).data)
    
    @action(detail=True, methods=['post'])
    def activate(self, request, id=None):
        """Activate template (set is_active=True)"""
        template = self.get_object()
        template.is_active = True
        template.save(update_fields=['is_active'])
        return Response(MessageTemplateSerializer(template).data)
    
    @action(detail=True, methods=['post'])
    def increment_usage(self, request, id=None):
        """Increment usage count and update last_used_at"""
        template = self.get_object()
        template.increment_usage()
        return Response(MessageTemplateSerializer(template).data)
    
    def perform_destroy(self, instance):
        """Prevent deletion of system default templates"""
        if instance.is_system_default:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("System default templates cannot be deleted.")
        super().perform_destroy(instance)
    
    @action(detail=True, methods=['post'], url_path='set-default')
    def set_default(self, request, id=None):
        """Set this template as the event's default template"""
        template = self.get_object()
        
        # Unset other defaults for this event
        MessageTemplate.objects.filter(event=template.event, is_default=True).exclude(id=template.id).update(is_default=False)
        
        # Set this template as default
        template.is_default = True
        template.save(update_fields=['is_default'])
        
        return Response(MessageTemplateSerializer(template).data)
    
    @action(detail=True, methods=['post'], url_path='preview-with-guest')
    def preview_with_guest(self, request, id=None):
        """Preview template with specific guest data"""
        template = self.get_object()
        guest_id = request.data.get('guest_id')
        
        if not guest_id:
            return Response({'error': 'guest_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            guest = Guest.objects.get(id=guest_id, event=template.event)
        except Guest.DoesNotExist:
            return Response({'error': 'Guest not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get base URL from request
        base_url = request.build_absolute_uri('/').rstrip('/')
        
        # Render template with guest data
        from .utils import render_template_with_guest
        rendered_message, warnings = render_template_with_guest(
            template.template_text,
            template.event,
            guest,
            base_url
        )
        
        return Response({
            'preview': rendered_message,
            'warnings': warnings,
            'template': MessageTemplateSerializer(template).data,
            'guest': GuestSerializer(guest).data,
        })


# Standalone view functions for WhatsApp template actions
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whatsapp_template_preview(request, id):
    """Preview template with sample data"""
    try:
        template = MessageTemplate.objects.get(id=id)
        # Verify ownership
        if template.event.host != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access templates for your own events.")
        
        sample_data = request.data.get('sample_data', {})
        preview_text = template.get_preview(sample_data)
        return Response({
            'preview': preview_text,
            'template': MessageTemplateSerializer(template).data
        })
    except MessageTemplate.DoesNotExist:
        return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whatsapp_template_duplicate(request, id):
    """Duplicate a template"""
    try:
        template = MessageTemplate.objects.get(id=id)
        # Verify ownership
        if template.event.host != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access templates for your own events.")
        
        new_name = request.data.get('name') or f"{template.name} (Copy)"
        
        # Check if name already exists
        if MessageTemplate.objects.filter(event=template.event, name=new_name).exists():
            return Response(
                {'error': f'A template with the name "{new_name}" already exists for this event.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        new_template = MessageTemplate.objects.create(
            event=template.event,
            name=new_name,
            message_type=template.message_type,
            template_text=template.template_text,
            description=template.description,
            is_active=True,
            usage_count=0,
            last_used_at=None
        )
        
        return Response(
            MessageTemplateSerializer(new_template).data,
            status=status.HTTP_201_CREATED
        )
    except MessageTemplate.DoesNotExist:
        return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whatsapp_template_archive(request, id):
    """Archive a template"""
    try:
        template = MessageTemplate.objects.get(id=id)
        # Verify ownership
        if template.event.host != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access templates for your own events.")
        
        template.is_active = False
        template.save(update_fields=['is_active'])
        return Response(MessageTemplateSerializer(template).data)
    except MessageTemplate.DoesNotExist:
        return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whatsapp_template_activate(request, id):
    """Activate a template"""
    try:
        template = MessageTemplate.objects.get(id=id)
        # Verify ownership
        if template.event.host != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access templates for your own events.")
        
        template.is_active = True
        template.save(update_fields=['is_active'])
        return Response(MessageTemplateSerializer(template).data)
    except MessageTemplate.DoesNotExist:
        return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whatsapp_template_increment_usage(request, id):
    """Increment template usage"""
    try:
        template = MessageTemplate.objects.get(id=id)
        # Verify ownership
        if template.event.host != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access templates for your own events.")
        
        template.increment_usage()
        return Response(MessageTemplateSerializer(template).data)
    except MessageTemplate.DoesNotExist:
        return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whatsapp_template_set_default(request, id):
    """Set this template as the event's default template"""
    try:
        template = MessageTemplate.objects.get(id=id)
        # Verify ownership
        if template.event.host != request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access templates for your own events.")
        
        # System default templates cannot be set as event defaults
        if template.is_system_default:
            return Response(
                {'error': 'System default templates cannot be set as event defaults'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Unset other defaults for this event
        MessageTemplate.objects.filter(event=template.event, is_default=True).exclude(id=template.id).update(is_default=False)
        
        # Set this template as default
        template.is_default = True
        template.save(update_fields=['is_default'])
        
        return Response(MessageTemplateSerializer(template).data)
    except MessageTemplate.DoesNotExist:
        return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)


# -------------------------
# IMPACT ENDPOINTS
# -------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_event_impact(request, id):
    """Get impact data for a specific event"""
    from .utils import calculate_event_impact
    from datetime import date
    
    event = get_object_or_404(Event, id=id)
    
    # Verify ownership
    if event.host != request.user:
        raise PermissionDenied("You can only access your own events.")
    
    impact = calculate_event_impact(event)
    
    if impact is None:
        # Event not expired yet
        return Response({
            'event_id': event.id,
            'event_title': event.title,
            'event_date': event.date.isoformat() if event.date else None,
            'expiry_date': event.expiry_date.isoformat() if event.expiry_date else None,
            'is_expired': False,
            'impact': None,
            'message': 'Event has not expired yet. Impact data will be available after the event expiry date.'
        })
    
    return Response({
        'event_id': event.id,
        'event_title': event.title,
        'event_date': event.date.isoformat() if event.date else None,
        'expiry_date': event.expiry_date.isoformat() if event.expiry_date else None,
        'is_expired': True,
        'impact': impact
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_overall_impact(request):
    """Get overall impact data across all user's expired events"""
    from .utils import calculate_event_impact
    from datetime import date
    
    # Get all expired events for the user
    user_events = Event.objects.filter(host=request.user)
    expired_events = []
    
    for event in user_events:
        try:
            expiry = event.expiry_date or event.date
        except AttributeError:
            expiry = event.date
        
        if expiry and expiry < date.today():
            expired_events.append(event)
    
    # Calculate impact for each expired event
    total_plates_saved = 0
    total_paper_saved = 0
    total_gifts_received = 0
    total_gift_value_paise = 0
    total_paper_saved_on_gifts = 0
    
    events_with_impact = []
    
    for event in expired_events:
        impact = calculate_event_impact(event)
        if impact:
            # Aggregate totals
            total_plates_saved += impact.get('food_saved', {}).get('plates_saved', 0)
            total_paper_saved += impact.get('paper_saved', {}).get('web_rsvps', 0)
            total_gifts_received += impact.get('gifts_received', {}).get('total_gifts', 0)
            total_gift_value_paise += impact.get('gifts_received', {}).get('total_value_paise', 0)
            total_paper_saved_on_gifts += impact.get('paper_saved_on_gifts', {}).get('cash_gifts', 0)
            
            events_with_impact.append({
                'event_id': event.id,
                'event_title': event.title,
                'event_date': event.date.isoformat() if event.date else None,
                'expiry_date': event.expiry_date.isoformat() if event.expiry_date else None,
                'impact': impact
            })
    
    return Response({
        'total_plates_saved': total_plates_saved,
        'total_paper_saved': total_paper_saved,
        'total_gifts_received': total_gifts_received,
        'total_gift_value_rupees': total_gift_value_paise / 100 if total_gift_value_paise else 0,
        'total_paper_saved_on_gifts': total_paper_saved_on_gifts,
        'expired_events_count': len(expired_events),
        'events': events_with_impact
    })



