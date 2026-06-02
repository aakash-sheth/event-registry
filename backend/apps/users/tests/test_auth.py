from django.test import TestCase
from apps.users.models import User


class AuthEmailAndPasswordTests(TestCase):
    def test_get_by_email_case_insensitive(self):
        User.objects.create_user(email='Host@Example.com', name='Host')
        user = User.objects.get_by_email('host@example.com')
        # Domain is normalized on create; lookup is case-insensitive
        self.assertEqual(user.email, 'Host@example.com')

    def test_verify_password_hashes_legacy_plaintext(self):
        user = User.objects.create_user(email='plain@example.com', name='Plain')
        # Simulate legacy admin edit that stored plaintext without hashing
        User.objects.filter(pk=user.pk).update(password='LegacyPass1')
        user.refresh_from_db()
        self.assertTrue(user.verify_password('LegacyPass1'))
        user.refresh_from_db()
        self.assertTrue(user.check_password('LegacyPass1'))

    def test_save_hashes_plaintext_password_field(self):
        user = User.objects.create_user(email='admin@example.com', name='Admin')
        user.password = 'AdminPass1'
        user.save()
        user.refresh_from_db()
        self.assertTrue(user.check_password('AdminPass1'))
