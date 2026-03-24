from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User
from django.utils import timezone


class UserSerializer(serializers.ModelSerializer):
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'email_verified', 'created_at', 'has_password', 'is_staff')
        read_only_fields = ('id', 'email_verified', 'created_at', 'has_password', 'is_staff')
    
    def get_has_password(self, obj):
        """Check if user has a usable password set"""
        return obj.has_usable_password()


class OTPSendSerializer(serializers.Serializer):
    email = serializers.EmailField()


class OTPVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6, min_length=6)


class PasswordCheckSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})


class SetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'}, min_length=8)
    
    def validate_password(self, value):
        """Validate password strength"""
        validate_password(value)
        # Additional custom validation: require mix of letters and numbers
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError("Password must contain at least one letter.")
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError("Password must contain at least one number.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6, min_length=6, help_text="OTP verification code")
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'}, min_length=8)
    
    def validate_new_password(self, value):
        """Validate new password strength"""
        validate_password(value)
        # Additional custom validation: require mix of letters and numbers
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError("Password must contain at least one letter.")
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError("Password must contain at least one number.")
        return value


class DisablePasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.CharField()
    email = serializers.EmailField()
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'}, min_length=8)

    def validate_new_password(self, value):
        """Validate new password strength"""
        validate_password(value)
        # Additional custom validation: require mix of letters and numbers
        if not any(c.isalpha() for c in value):
            raise serializers.ValidationError("Password must contain at least one letter.")
        if not any(c.isdigit() for c in value):
            raise serializers.ValidationError("Password must contain at least one number.")
        return value


# ---------------------------------------------------------------------------
# Staff / Customer Support Serializers
# ---------------------------------------------------------------------------

class StaffUserLookupSerializer(serializers.ModelSerializer):
    has_password = serializers.SerializerMethodField()
    is_locked = serializers.SerializerMethodField()
    lock_expires_at = serializers.DateTimeField(source='account_locked_until', read_only=True)
    events = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'name', 'is_active', 'email_verified',
            'created_at', 'has_password', 'is_locked', 'lock_expires_at',
            'failed_password_attempts', 'events',
        )

    def get_has_password(self, obj):
        return obj.has_usable_password()

    def get_is_locked(self, obj):
        return bool(obj.account_locked_until and timezone.now() < obj.account_locked_until)

    def get_events(self, obj):
        return list(
            obj.events.values('id', 'slug', 'title', 'event_type', 'created_at', 'is_public')
            .order_by('-created_at')[:10]
        )


class StaffSetActiveSerializer(serializers.Serializer):
    email = serializers.EmailField()
    is_active = serializers.BooleanField()
    reason = serializers.CharField(required=False, allow_blank=True, max_length=500)


class StaffExtendExpirySerializer(serializers.Serializer):
    event_slug = serializers.SlugField()
    extend_days = serializers.IntegerField(min_value=1, max_value=365)

