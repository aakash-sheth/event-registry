from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User


class UserSerializer(serializers.ModelSerializer):
    has_password = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'email_verified', 'created_at', 'has_password')
        read_only_fields = ('id', 'email_verified', 'created_at', 'has_password')
    
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

