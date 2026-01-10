from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password


class UserManager(BaseUserManager):
    def create_user(self, email, name=None, password=None):
        if not email:
            raise ValueError('Users must have an email address')
        user = self.model(email=self.normalize_email(email), name=name)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name=None, password=None):
        user = self.create_user(email, name, password)
        user.is_active = True
        user.is_staff = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Email verification
    email_verified = models.BooleanField(default=False)
    
    # OTP fields
    otp_code = models.CharField(max_length=255, blank=True, null=True)
    otp_expires_at = models.DateTimeField(blank=True, null=True)
    
    # Password reset fields
    password_reset_token = models.CharField(max_length=255, blank=True, null=True)
    password_reset_expires_at = models.DateTimeField(blank=True, null=True)
    
    # Account lockout fields (for password attempts)
    failed_password_attempts = models.IntegerField(default=0)
    account_locked_until = models.DateTimeField(blank=True, null=True)
    
    objects = UserManager()
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []
    
    class Meta:
        db_table = 'users'
    
    def __str__(self):
        return self.email
    
    def set_otp(self, code):
        """Hash and store OTP code with expiry"""
        self.otp_code = make_password(code)
        self.otp_expires_at = timezone.now() + timezone.timedelta(minutes=15)
        self.save(update_fields=['otp_code', 'otp_expires_at'])
    
    def verify_otp(self, code):
        """Verify OTP code and check expiry
        
        Returns:
            tuple: (is_valid: bool, error_message: str or None)
        """
        if not self.otp_code or not self.otp_expires_at:
            return False, 'No verification code found. Please request a new code.'
        if timezone.now() > self.otp_expires_at:
            return False, 'Verification code has expired. Please request a new code.'
        if not check_password(code, self.otp_code):
            return False, 'Invalid verification code. Please check and try again.'
        return True, None
    
    def clear_otp(self):
        """Clear OTP after successful verification"""
        self.otp_code = None
        self.otp_expires_at = None
        self.save(update_fields=['otp_code', 'otp_expires_at'])
    
    def set_password_reset_token(self, token):
        """Store password reset token with expiry"""
        self.password_reset_token = make_password(token)
        self.password_reset_expires_at = timezone.now() + timezone.timedelta(minutes=15)
        self.save(update_fields=['password_reset_token', 'password_reset_expires_at'])
    
    def verify_password_reset_token(self, token):
        """Verify password reset token and check expiry
        
        Returns:
            tuple: (is_valid: bool, error_message: str or None)
        """
        if not self.password_reset_token or not self.password_reset_expires_at:
            return False, 'No password reset token found. Please request a new one.'
        if timezone.now() > self.password_reset_expires_at:
            return False, 'Password reset token has expired. Please request a new one.'
        if not check_password(token, self.password_reset_token):
            return False, 'Invalid password reset token.'
        return True, None
    
    def clear_password_reset_token(self):
        """Clear password reset token after successful reset"""
        self.password_reset_token = None
        self.password_reset_expires_at = None
        self.save(update_fields=['password_reset_token', 'password_reset_expires_at'])
    
    def is_account_locked(self):
        """Check if account is currently locked due to failed password attempts"""
        if self.account_locked_until and timezone.now() < self.account_locked_until:
            return True
        # Clear lock if expired
        if self.account_locked_until and timezone.now() >= self.account_locked_until:
            self.account_locked_until = None
            self.failed_password_attempts = 0
            self.save(update_fields=['account_locked_until', 'failed_password_attempts'])
        return False
    
    def record_failed_password_attempt(self):
        """Record a failed password attempt and lock account if threshold reached"""
        self.failed_password_attempts += 1
        if self.failed_password_attempts >= 5:
            # Lock account for 15 minutes
            self.account_locked_until = timezone.now() + timezone.timedelta(minutes=15)
        self.save(update_fields=['failed_password_attempts', 'account_locked_until'])
    
    def clear_failed_password_attempts(self):
        """Clear failed password attempts (called on successful login)"""
        self.failed_password_attempts = 0
        self.account_locked_until = None
        self.save(update_fields=['failed_password_attempts', 'account_locked_until'])

