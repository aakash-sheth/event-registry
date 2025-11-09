from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
import csv
from .models import Event, RSVP, Guest
from .serializers import (
    EventSerializer, EventCreateSerializer,
    RSVPSerializer, RSVPCreateSerializer,
    GuestSerializer, GuestCreateSerializer
)
from .utils import get_country_code, format_phone_with_country_code
from apps.items.models import RegistryItem
from apps.items.serializers import RegistryItemSerializer


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Hosts can only see their own events - strict privacy enforcement"""
        return Event.objects.filter(host=self.request.user)
    
    def get_object(self):
        """Override to ensure host can only access their own events"""
        obj = super().get_object()
        # Double-check ownership (even though queryset is filtered)
        if obj.host != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access your own events.")
        return obj
    
    def get_serializer_class(self):
        if self.action == 'create':
            return EventCreateSerializer
        return EventSerializer
    
    def perform_create(self, serializer):
        """Ensure event is created with current user as host"""
        serializer.save(host=self.request.user)
    
    def _verify_event_ownership(self, event):
        """Helper method to verify event ownership - raises PermissionDenied if not owner"""
        if not self.request.user.is_authenticated:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Authentication required.")
        if event.host != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access your own events and their data.")
        return True
    
    @action(detail=True, methods=['get'])
    def orders(self, request, id=None):
        """Get orders for this event - host only, privacy protected"""
        event = self.get_object()
        self._verify_event_ownership(event)  # Explicit ownership check
        
        from apps.orders.models import Order
        from apps.orders.serializers import OrderSerializer
        
        # Only get orders for this specific event (already verified ownership)
        orders = Order.objects.filter(event=event).order_by('-created_at')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def rsvps(self, request, id=None):
        """Get RSVPs for this event - host only, privacy protected"""
        event = self.get_object()
        self._verify_event_ownership(event)  # Explicit ownership check
        
        # Only get RSVPs for this specific event (already verified ownership)
        rsvps = RSVP.objects.filter(event=event).order_by('-created_at')
        serializer = RSVPSerializer(rsvps, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get', 'post'])
    def guests(self, request, id=None):
        """Get or create guests for this event - host only, privacy protected"""
        event = self.get_object()
        self._verify_event_ownership(event)  # Explicit ownership check
        
        if request.method == 'GET':
            # Only get guests for this specific event (already verified ownership)
            guests = Guest.objects.filter(event=event).order_by('name')
            serializer = GuestSerializer(guests, many=True)
            return Response(serializer.data)
        
        elif request.method == 'POST':
            # Bulk create from list
            guests_data = request.data.get('guests', [])
            if not isinstance(guests_data, list):
                return Response({'error': 'guests must be a list'}, status=status.HTTP_400_BAD_REQUEST)
            
            created_guests = []
            errors = []
            event_country_code = get_country_code(event.country)
            
            for idx, guest_data in enumerate(guests_data):
                serializer = GuestCreateSerializer(data=guest_data)
                if serializer.is_valid():
                    phone = serializer.validated_data.get('phone', '')
                    # Format phone with country code if not already formatted
                    if phone and not phone.startswith('+'):
                        country_code = guest_data.get('country_code') or event_country_code
                        phone = format_phone_with_country_code(phone, country_code)
                    
                    # Check if guest with this phone already exists
                    existing_guest = Guest.objects.filter(event=event, phone=phone).first()
                    if existing_guest:
                        errors.append(f"Guest {idx + 1}: Phone {phone} already exists (Name: {existing_guest.name})")
                        continue
                    # Event ownership already verified, safe to create
                    try:
                        guest_data['phone'] = phone
                        # Remove country_code from data before creating (keep country_iso)
                        country_iso = guest_data.pop('country_iso', None)
                        guest_data.pop('country_code', None)
                        guest = Guest.objects.create(
                            event=event,
                            country_iso=country_iso or '',
                            **{k: v for k, v in guest_data.items() if k not in ['country_code', 'country_iso']}
                        )
                        created_guests.append(guest)
                    except Exception as e:
                        errors.append(f"Guest {idx + 1}: {str(e)}")
                else:
                    errors.append(f"Guest {idx + 1}: {serializer.errors}")
            
            response_data = GuestSerializer(created_guests, many=True).data
            if errors:
                response_data = {'created': response_data, 'errors': errors}
            
            status_code = status.HTTP_201_CREATED if created_guests else status.HTTP_400_BAD_REQUEST
            return Response(response_data, status=status_code)
    
    @action(detail=True, methods=['post'], url_path='guests/import')
    def import_guests_csv(self, request, id=None):
        """Import guests from CSV file - host only, privacy protected"""
        event = self.get_object()
        self._verify_event_ownership(event)  # Explicit ownership check
        
        if 'file' not in request.FILES:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        import csv
        import io
        
        file = request.FILES['file']
        decoded_file = file.read().decode('utf-8')
        io_string = io.StringIO(decoded_file)
        reader = csv.DictReader(io_string)
        
        created_count = 0
        errors = []
        
        event_country_code = get_country_code(event.country)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 (1 is header)
            try:
                name = row.get('name') or row.get('Name') or row.get('NAME')
                phone = row.get('phone') or row.get('Phone') or row.get('PHONE')
                
                if not name or not name.strip():
                    errors.append(f"Row {row_num}: Name is required")
                    continue
                
                if not phone or not phone.strip():
                    errors.append(f"Row {row_num}: Phone number is required")
                    continue
                
                # Clean phone number
                phone_clean = phone.strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
                phone_digits = ''.join(filter(str.isdigit, phone_clean))
                
                # If phone is exactly 10 digits, add event's country code
                if len(phone_digits) == 10:
                    phone = f"{event_country_code}{phone_digits}"
                else:
                    # Format phone with country code (handles various formats)
                    phone = format_phone_with_country_code(phone.strip(), event_country_code)
                
                # Validate phone format (should start with + and have digits)
                if not phone.startswith('+') or len(phone.replace('+', '')) < 10:
                    errors.append(f"Row {row_num}: Invalid phone number format: {phone}")
                    continue
                
                # Check if guest with this phone already exists for this event
                existing_guest = Guest.objects.filter(event=event, phone=phone).first()
                if existing_guest:
                    # Guest with this phone already exists - skip and report
                    errors.append(f"Row {row_num}: Guest with phone {phone} already exists (Name: {existing_guest.name})")
                    continue
                
                Guest.objects.create(
                    event=event,
                    name=name.strip(),
                    phone=phone,
                    country_iso='',  # CSV import doesn't have country ISO, can be updated later
                    email=(row.get('email') or row.get('Email') or row.get('EMAIL') or '').strip() or None,
                    relationship=(row.get('relationship') or row.get('Relationship') or '').strip() or '',
                    notes=(row.get('notes') or row.get('Notes') or '').strip() or '',
                )
                created_count += 1
            except Exception as e:
                errors.append(f"Row {row_num}: {str(e)}")
        
        return Response({
            'created': created_count,
            'errors': errors if errors else None
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['put', 'patch'], url_path='guests/(?P<guest_id>[^/.]+)')
    def update_guest(self, request, id=None, guest_id=None):
        """Update a guest in the list - host only, privacy protected"""
        event = self.get_object()
        self._verify_event_ownership(event)  # Explicit ownership check
        
        try:
            guest = Guest.objects.get(id=guest_id, event=event)
        except Guest.DoesNotExist:
            return Response({'error': 'Guest not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = GuestCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Format phone with country code
        phone = serializer.validated_data.get('phone', '')
        if phone and not phone.startswith('+'):
            country_code = request.data.get('country_code') or get_country_code(event.country)
            phone = format_phone_with_country_code(phone, country_code)
        
        # Check if phone is being changed and if new phone already exists
        if phone and phone != guest.phone:
            existing_guest = Guest.objects.filter(event=event, phone=phone).exclude(id=guest.id).first()
            if existing_guest:
                return Response(
                    {'error': f'Phone number {phone} already exists (Name: {existing_guest.name})'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Update guest fields
        guest.name = serializer.validated_data.get('name', guest.name)
        guest.phone = phone or guest.phone
        guest.country_iso = request.data.get('country_iso', guest.country_iso) or ''
        guest.email = serializer.validated_data.get('email') or None
        guest.relationship = serializer.validated_data.get('relationship', '')
        guest.notes = serializer.validated_data.get('notes', '')
        guest.save()
        
        return Response(GuestSerializer(guest).data, status=status.HTTP_200_OK)
    
    def delete_guest(self, request, id=None, guest_id=None):
        """Delete a guest from the list - host only, privacy protected"""
        event = self.get_object()
        self._verify_event_ownership(event)  # Explicit ownership check
        
        try:
            # Only allow deleting guests from this specific event (ownership already verified)
            guest = Guest.objects.get(id=guest_id, event=event)
            guest.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Guest.DoesNotExist:
            return Response({'error': 'Guest not found'}, status=status.HTTP_404_NOT_FOUND)
    
    @action(detail=True, methods=['put', 'patch'], url_path='design')
    def update_design(self, request, id=None):
        """Update event page design - host only, privacy protected"""
        event = self.get_object()
        self._verify_event_ownership(event)  # Explicit ownership check
        
        # Update design fields
        banner_image = request.data.get('banner_image', '')
        description = request.data.get('description', '')
        additional_photos = request.data.get('additional_photos', [])
        
        # Validate additional_photos (max 5)
        if isinstance(additional_photos, list) and len(additional_photos) > 5:
            return Response(
                {'error': 'Maximum 5 additional photos allowed'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update event
        if banner_image is not None:
            event.banner_image = banner_image
        if description is not None:
            event.description = description
        if additional_photos is not None:
            event.additional_photos = additional_photos if isinstance(additional_photos, list) else []
        
        event.save()
        return Response(EventSerializer(event).data, status=status.HTTP_200_OK)
    
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
            'RSVP Date'
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
        """Only return public events - no private data exposed"""
        return Event.objects.filter(is_public=True)
    
    @action(detail=True, methods=['get'])
    def items(self, request, slug=None):
        """Get active items for public registry - no private data exposed"""
        event = get_object_or_404(Event, slug=slug, is_public=True)
        
        # Check if registry is enabled for this event
        if not event.has_registry:
            return Response(
                {'error': 'Gift registry is not available for this event'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Only return active items - no guest list, no RSVPs, no order details
        items = RegistryItem.objects.filter(event=event, status='active').order_by('priority_rank', 'name')
        
        # Calculate remaining quantities
        items_data = []
        for item in items:
            remaining = item.qty_total - item.qty_purchased
            item_dict = RegistryItemSerializer(item).data
            item_dict['remaining'] = remaining
            items_data.append(item_dict)
        
        return Response({
            'event': EventSerializer(event).data,
            'items': items_data,
        })


@api_view(['POST'])
@permission_classes([AllowAny])
def create_rsvp(request, event_id):
    """Create RSVP for an event (public endpoint)"""
    try:
        event = get_object_or_404(Event, id=event_id, is_public=True)
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
        
        # Check if this RSVP matches a guest in the guest list
        guest = None
        if event.guest_list.exists():
            # Try to match by phone first, then by name
            guest = Guest.objects.filter(event=event, phone=phone).first()
            if not guest:
                guest = Guest.objects.filter(event=event, name__iexact=name).first()
        
        # Check if RSVP already exists for this phone
        existing_rsvp = RSVP.objects.filter(event=event, phone=phone).first()
        
        # Update phone in validated_data and remove country_code (not a model field)
        serializer.validated_data['phone'] = phone
        rsvp_data = {k: v for k, v in serializer.validated_data.items() if k != 'country_code'}
        
        if existing_rsvp:
            # Update existing RSVP
            for key, value in rsvp_data.items():
                setattr(existing_rsvp, key, value)
            if guest:
                existing_rsvp.guest = guest
            existing_rsvp.save()
            return Response(RSVPSerializer(existing_rsvp).data, status=status.HTTP_200_OK)
        else:
            # Create new RSVP
            rsvp = RSVP.objects.create(event=event, guest=guest, **rsvp_data)
            return Response(RSVPSerializer(rsvp).data, status=status.HTTP_201_CREATED)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
