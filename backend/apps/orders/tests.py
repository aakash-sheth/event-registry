"""
Unit tests for orders app
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.events.models import Event
from apps.items.models import RegistryItem
from apps.orders.models import Order
from apps.orders.services import OrderService, RazorpayService
from django.db import transaction

User = get_user_model()


class OrderServiceTestCase(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            email='host@test.com',
            name='Test Host'
        )
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True
        )
        self.item = RegistryItem.objects.create(
            event=self.event,
            name='Test Item',
            price_inr=10000,  # ₹100
            qty_total=5,
            status='active'
        )
    
    def test_create_order(self):
        """Test order creation"""
        order, rzp_order = OrderService.create_order(
            event_id=self.event.id,
            item_id=self.item.id,
            buyer_name='Test Buyer',
            buyer_email='buyer@test.com',
            buyer_phone='1234567890'
        )
        
        self.assertEqual(order.buyer_name, 'Test Buyer')
        self.assertEqual(order.amount_inr, 10000)
        self.assertEqual(order.status, 'pending')
        self.assertIsNotNone(order.rzp_order_id)
    
    def test_create_order_out_of_stock(self):
        """Test order creation fails when item is out of stock"""
        self.item.qty_purchased = 5
        self.item.save()
        
        with self.assertRaises(ValueError):
            OrderService.create_order(
                event_id=self.event.id,
                item_id=self.item.id,
                buyer_name='Test Buyer',
                buyer_email='buyer@test.com'
            )
    
    def test_fulfill_order_updates_inventory(self):
        """Test order fulfillment updates item inventory"""
        order = Order.objects.create(
            event=self.event,
            item=self.item,
            buyer_name='Test Buyer',
            buyer_email='buyer@test.com',
            amount_inr=10000,
            status='pending',
            rzp_order_id='order_test123'
        )
        
        initial_purchased = self.item.qty_purchased
        
        # Mock signature verification (in real test, would use actual signature)
        # For now, we'll skip signature verification in test
        fulfilled_order = OrderService.fulfill_order(
            order.id,
            'payment_test123',
            'test_signature'
        )
        
        # Refresh from DB
        self.item.refresh_from_db()
        self.assertEqual(self.item.qty_purchased, initial_purchased + 1)
        self.assertEqual(fulfilled_order.status, 'paid')

