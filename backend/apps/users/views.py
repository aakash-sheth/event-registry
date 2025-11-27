from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.conf import settings
import secrets
from .models import User
from .serializers import OTPSendSerializer, OTPVerifySerializer, UserSerializer
from apps.common.email_backend import send_email
from rest_framework.throttling import UserRateThrottle
from rest_framework.decorators import throttle_classes


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([UserRateThrottle])
def signup(request):
    """Register new user and send OTP"""
    email = request.data.get('email')
    name = request.data.get('name', '')
    
    if not email:
        return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Check if user already exists
    if User.objects.filter(email=email).exists():
        return Response(
            {'error': 'An account with this email already exists. Please login instead.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Create new user
    user = User.objects.create_user(email=email, name=name or email.split('@')[0])
    
    # Generate and send OTP
    return _send_otp(user)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([UserRateThrottle])
def otp_start(request):
    """Generate OTP and send email with login link (for existing users)"""
    serializer = OTPSendSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    email = serializer.validated_data['email']
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {'error': 'No account found with this email. Please sign up first.'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Generate and send OTP
    return _send_otp(user)


def _send_otp(user):
    """Helper function to generate and send OTP"""
    
    # Generate OTP
    otp_code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    user.set_otp(otp_code)
    
    # Create login token (simple hash of email + otp for link)
    import hashlib
    email = user.email
    token_data = f"{email}:{otp_code}"
    token = hashlib.sha256(token_data.encode()).hexdigest()[:32]
    
    # Send email with login link
    login_url = f"{settings.FRONTEND_ORIGIN}/host/login?token={token}&email={email}"
    subject = "Your Event Registry Verification Code"
    message = f"""
    Hi {user.name or 'there'},

    Your verification code is: {otp_code}

    Or click this link to verify directly:
    {login_url}

    This code expires in 15 minutes.

    If you didn't request this, please ignore this email.
    """
    
    # Send email via SES
    # Log failures but don't expose to user for security
    email_sent = False
    try:
        send_email(
            to_email=email,
            subject=subject,
            body_text=message,
        )
        email_sent = True
    except Exception as e:
        # Log email failure but don't expose to user
        import logging
        logger = logging.getLogger(__name__)
        error_str = str(e)
        logger.error(f'Failed to send OTP email to {email}: {error_str}')
        
        # Check if this is a SES sandbox error (email not verified)
        # In sandbox mode, SES requires both FROM and recipient emails to be verified
        if 'MessageRejected' in error_str or 'Email address is not verified' in error_str:
            logger.warning(f'SES sandbox mode detected - email verification required. Error: {error_str}')
        
        # Continue - we'll provide fallback for staging/testing
    
    # In development mode, log OTP to console for testing
    # This helps developers test without email configuration
    if settings.DEBUG:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f'[DEV MODE] OTP for {email}: {otp_code} (This only appears in development)')
    
    # Prepare response
    response_data = {
        'message': 'Verification code sent to your email',
        'token': token,  # Token for login link functionality
    }
    
    # Always include OTP in response if email sending failed (for staging/testing)
    # OR if in development mode
    # This allows testing without SES setup or while waiting for SES production access
    # In production with working email, OTP will NOT be included (email_sent=True and DEBUG=False)
    if settings.DEBUG or not email_sent:
        response_data['otp_code'] = otp_code
        if not email_sent:
            response_data['_dev_note'] = 'OTP included because email sending failed. This allows testing without SES setup. Once SES is configured, OTP will only be sent via email.'
        else:
            response_data['_dev_note'] = 'OTP included only in development mode'
    
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def otp_verify(request):
    """Verify OTP and return JWT tokens"""
    serializer = OTPVerifySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    email = serializer.validated_data['email']
    code = serializer.validated_data['code']
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid email or code'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verify OTP
    if not user.verify_otp(code):
        return Response(
            {'error': 'Invalid or expired code'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Clear OTP and verify email (if not already verified)
    user.clear_otp()
    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=['email_verified'])
    
    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
def me(request):
    """Get current user info"""
    return Response(UserSerializer(request.user).data)

