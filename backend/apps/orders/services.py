import razorpay
import hmac
import hashlib
from django.conf import settings
from django.db import transaction
from apps.items.models import RegistryItem
from apps.events.models import Event
from .models import Order


class RazorpayService:
    def __init__(self):
        self.is_configured = bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)
        if self.is_configured:
            self.client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
        else:
            self.client = None
    
    def create_order(self, amount_paise, currency='INR', receipt=None):
        """Create Razorpay order"""
        if not self.is_configured:
            # Return mock order for development
            import uuid
            return {
                'id': f'order_mock_{uuid.uuid4().hex[:16]}',
                'amount': amount_paise,
                'currency': currency,
                'status': 'created',
            }
        
        data = {
            'amount': amount_paise,
            'currency': currency,
        }
        if receipt:
            data['receipt'] = receipt
        
        order = self.client.order.create(data=data)
        return order
    
    def verify_webhook_signature(self, payload, signature):
        """Verify Razorpay webhook signature"""
        if not self.is_configured:
            # In development, allow any signature if Razorpay is not configured
            return True
        secret = settings.RAZORPAY_WEBHOOK_SECRET.encode('utf-8')
        expected_signature = hmac.new(
            secret,
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_signature, signature)
    
    def verify_payment_signature(self, order_id, payment_id, signature):
        """Verify payment signature"""
        if not self.is_configured:
            # In development, allow any signature if Razorpay is not configured
            return True
        params_string = f"{order_id}|{payment_id}"
        secret = settings.RAZORPAY_KEY_SECRET.encode('utf-8')
        expected_signature = hmac.new(
            secret,
            params_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected_signature, signature)


class OrderService:
    @staticmethod
    @transaction.atomic
    def create_order(event_id, item_id, buyer_name, buyer_email, buyer_phone, amount_inr=None):
        """Create order and Razorpay order"""
        event = Event.objects.get(id=event_id)
        
        if item_id:
            item = RegistryItem.objects.get(id=item_id, event=event)
            
            # Validate availability
            if item.status != 'active':
                raise ValueError("Item is not active")
            if item.remaining <= 0:
                raise ValueError("Item is out of stock")
            
            # Use item price if amount not provided
            if amount_inr is None:
                amount_inr = item.price_inr
            elif amount_inr != item.price_inr:
                raise ValueError("Amount does not match item price")
        else:
            # Cash gift (future feature)
            if amount_inr is None:
                raise ValueError("Amount required for cash gifts")
            item = None
        
        # Create order
        order = Order.objects.create(
            event=event,
            item=item,
            buyer_name=buyer_name,
            buyer_email=buyer_email,
            buyer_phone=buyer_phone or '',
            amount_inr=amount_inr,
            status='created',
        )
        
        # Create Razorpay order
        rzp_service = RazorpayService()
        rzp_order = rzp_service.create_order(
            amount_paise=amount_inr,
            receipt=f"order_{order.id}"
        )
        
        order.rzp_order_id = rzp_order['id']
        order.status = 'pending'
        order.save()
        
        return order, rzp_order
    
    @staticmethod
    @transaction.atomic
    def fulfill_order(order_id, payment_id, signature):
        """Mark order as paid and update inventory"""
        order = Order.objects.select_for_update().get(id=order_id)
        
        if order.status == 'paid':
            return order  # Already fulfilled
        
        # Verify signature
        rzp_service = RazorpayService()
        if not rzp_service.verify_payment_signature(order.rzp_order_id, payment_id, signature):
            raise ValueError("Invalid payment signature")
        
        # Update order
        order.status = 'paid'
        order.rzp_payment_id = payment_id
        order.rzp_signature = signature
        order.save()
        
        # Update item inventory
        if order.item:
            item = RegistryItem.objects.select_for_update().get(id=order.item.id)
            item.qty_purchased += 1
            item.save()
        
        return order

