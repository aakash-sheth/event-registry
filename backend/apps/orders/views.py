from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
import json
from .models import Order
from .serializers import OrderSerializer, OrderCreateSerializer
from .services import OrderService, RazorpayService
from apps.common.email_backend import send_email
from apps.events.models import Event
from apps.events.utils import get_country_code, format_phone_with_country_code
from django.conf import settings


@api_view(['POST'])
@permission_classes([AllowAny])
def create_order(request):
    """Create order and return Razorpay order details"""
    serializer = OrderCreateSerializer(data=request.data)
    if not serializer.is_valid():
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Order creation validation failed: {serializer.errors}, data: {request.data}')
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Format phone with country code if provided
        buyer_phone = serializer.validated_data.get('buyer_phone', '')
        if buyer_phone:
            event = Event.objects.get(id=serializer.validated_data['event_id'])
            event_country_code = get_country_code(event.country)
            if buyer_phone and not buyer_phone.startswith('+'):
                country_code = request.data.get('country_code') or event_country_code
                buyer_phone = format_phone_with_country_code(buyer_phone, country_code)
        
        order, rzp_order = OrderService.create_order(
            event_id=serializer.validated_data['event_id'],
            item_id=serializer.validated_data.get('item_id'),
            buyer_name=serializer.validated_data['buyer_name'],
            buyer_email=serializer.validated_data['buyer_email'],
            buyer_phone=buyer_phone,
            amount_inr=serializer.validated_data.get('amount_inr'),
        )
        
        # If using mock Razorpay (development), automatically mark as paid
        if rzp_order['id'].startswith('order_mock_'):
            # Auto-fulfill mock orders in development
            try:
                payment_id = f"mock_payment_{order.id}"
                fulfilled_order = OrderService.fulfill_order(order.id, payment_id, 'mock_signature')
                # Send emails
                send_order_emails(fulfilled_order)
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f'Failed to auto-fulfill mock order: {e}')
        
        return Response({
            'order_id': order.id,
            'rzp_order_id': rzp_order['id'],
            'amount': rzp_order['amount'],
            'currency': rzp_order['currency'],
            'rzp_key_id': settings.RAZORPAY_KEY_ID if settings.RAZORPAY_KEY_ID else '',
        }, status=status.HTTP_201_CREATED)
    
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_order(request, order_id):
    """Get order details - host only, strict privacy protection"""
    try:
        order = Order.objects.get(id=order_id)
        # Strict ownership verification - host can only see orders for their own events
        if order.event.host != request.user:
            return Response(
                {'error': 'Permission denied. You can only access orders for your own events.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return Response(OrderSerializer(order).data)
    except Order.DoesNotExist:
        return Response(
            {'error': 'Order not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def razorpay_webhook(request):
    """Handle Razorpay webhook"""
    payload = request.body.decode('utf-8')
    signature = request.headers.get('X-Razorpay-Signature', '')
    
    # Verify signature
    rzp_service = RazorpayService()
    if not rzp_service.verify_webhook_signature(payload, signature):
        return Response({'error': 'Invalid signature'}, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        data = json.loads(payload)
        event = data.get('event')
        
        if event == 'payment.captured':
            payment = data.get('payload', {}).get('payment', {}).get('entity', {})
            order_id = payment.get('order_id')
            payment_id = payment.get('id')
            
            # Find order by rzp_order_id
            try:
                order = Order.objects.get(rzp_order_id=order_id, status__in=['created', 'pending'])
            except Order.DoesNotExist:
                return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Fulfill order (use payment signature from payment entity)
            try:
                payment_signature = payment.get('signature', '')
                fulfilled_order = OrderService.fulfill_order(order.id, payment_id, payment_signature)
                
                # Send emails
                send_order_emails(fulfilled_order)
                
                return Response({'status': 'success'}, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({'status': 'ignored'}, status=status.HTTP_200_OK)
    
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def send_order_emails(order):
    """Send receipt to guest and alert to host"""
    event = order.event
    item_name = order.item.name if order.item else 'Cash Gift'
    amount_rupees = order.amount_inr / 100
    
    # Guest receipt
    guest_subject = f"Thank you for your gift! - {event.title}"
    guest_body = f"""
    Hi {order.buyer_name},

    Thank you so much for your generous gift of ₹{amount_rupees} for '{item_name}'!

    We truly appreciate your thoughtfulness and support.

    Best regards,
    {event.host.name or event.host.email}
    """
    
    try:
        send_email(
            to_email=order.buyer_email,
            subject=guest_subject,
            body_text=guest_body,
        )
    except Exception as e:
        print(f"Failed to send guest email: {e}")
    
    # Host alert
    host_subject = f"New gift received! - {event.title}"
    host_body = f"""
    Hi {event.host.name or 'there'},

    Great news! You received a new gift:

    From: {order.buyer_name} ({order.buyer_email})
    Item: {item_name}
    Amount: ₹{amount_rupees}

    Don't forget to send a thank you note!

    View all gifts: {settings.FRONTEND_ORIGIN}/host/events/{event.id}
    """
    
    try:
        send_email(
            to_email=event.host.email,
            subject=host_subject,
            body_text=host_body,
        )
    except Exception as e:
        print(f"Failed to send host email: {e}")

