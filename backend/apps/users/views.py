from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.hashers import check_password
import secrets
import hashlib
from .models import User
from .serializers import (
    OTPSendSerializer, OTPVerifySerializer, UserSerializer,
    PasswordCheckSerializer, PasswordLoginSerializer, SetPasswordSerializer,
    ChangePasswordSerializer, DisablePasswordSerializer,
    ForgotPasswordSerializer, ResetPasswordSerializer,
    StaffUserLookupSerializer, StaffSetActiveSerializer, StaffExtendExpirySerializer,
)
from apps.notifications.models import NotificationLog
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
    
    # Extract first name from user.name (split by space, take first part, fallback to full name or "there")
    user_name = user.name or ''
    first_name = user_name.split()[0] if user_name and user_name.strip() else None
    greeting_name = first_name if first_name else 'there'
    
    subject = "Your EkFern Verification Code"
    message = f"""Hi {greeting_name},

Your EkFern verification code is:

{otp_code}

Enter this code on the verification screen to continue.
This code expires in 15 minutes. Please do not share it with anyone.

To open the verification page, use this link:
{login_url}

If you didn't request this, you can safely ignore this email.

— Team EkFern"""

    html_message = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#2d5a27;padding:28px 40px;text-align:center;">
            <span style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:1px;">EkFern</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 24px;">
            <p style="margin:0 0 8px;font-size:16px;color:#333;">Hi {greeting_name},</p>
            <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
              Use the verification code below to sign in to your EkFern account.
            </p>
            <div style="text-align:center;margin:0 0 28px;">
              <span style="display:inline-block;background:#f5f5f0;border:2px solid #2d5a27;border-radius:8px;padding:16px 40px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#2d5a27;font-family:monospace;">{otp_code}</span>
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-align:center;">
              This code expires in <strong>15 minutes</strong>. Do not share it with anyone.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px 28px;text-align:center;">
            <a href="{login_url}" style="display:inline-block;background:#2d5a27;color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:6px;font-size:15px;font-weight:bold;">
              Open verification page →
            </a>
          </td>
        </tr>
        <tr>
          <td style="border-top:1px solid #eee;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              If you didn't request this, you can safely ignore this email.<br>
              &copy; EkFern · <a href="https://ekfern.com" style="color:#aaa;">ekfern.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    # Send email via SES
    # Log failures but don't expose to user for security
    email_sent = False
    try:
        send_email(
            to_email=email,
            subject=subject,
            body_text=message,
            body_html=html_message,
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
    is_valid, error_message = user.verify_otp(code)
    if not is_valid:
        return Response(
            {'error': error_message},
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


@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([UserRateThrottle])
def check_password_enabled(request):
    """Check if user has password enabled"""
    email = request.query_params.get('email')
    if not email:
        return Response(
            {'error': 'Email parameter is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        user = User.objects.get(email=email)
        return Response({
            'has_password': user.has_usable_password()
        }, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        # Return False for non-existent users (don't reveal if email exists)
        return Response({
            'has_password': False
        }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([UserRateThrottle])
def password_login(request):
    """Authenticate user with password and return JWT tokens"""
    serializer = PasswordLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    email = serializer.validated_data['email']
    password = serializer.validated_data['password']
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid email or password'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Check if account is locked
    if user.is_account_locked():
        return Response(
            {'error': 'Account is temporarily locked due to too many failed login attempts. Please try again in 15 minutes.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )
    
    # Check if user has password enabled
    if not user.has_usable_password():
        return Response(
            {'error': 'Password login is not enabled for this account. Please use OTP login.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Authenticate user
    user_auth = authenticate(request, username=email, password=password)
    if user_auth is None:
        # Record failed attempt
        user.record_failed_password_attempt()
        return Response(
            {'error': 'Invalid email or password'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Clear failed attempts on successful login
    user.clear_failed_password_attempts()
    
    # Verify email if not already verified
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_password(request):
    """Set password for user (requires authentication)"""
    serializer = SetPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    user = request.user
    password = serializer.validated_data['password']
    
    # Check if password already set
    if user.has_usable_password():
        return Response(
            {'error': 'Password is already set. Use change-password endpoint to update it.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Set password
    user.set_password(password)
    user.save()
    
    return Response({
        'message': 'Password set successfully'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change password for authenticated user using OTP verification"""
    serializer = ChangePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    user = request.user
    code = serializer.validated_data['code']
    new_password = serializer.validated_data['new_password']
    
    # Check if user has password
    if not user.has_usable_password():
        return Response(
            {'error': 'Password is not set. Use set-password endpoint to set it.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verify OTP
    is_valid, error_message = user.verify_otp(code)
    if not is_valid:
        return Response(
            {'error': error_message},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Clear OTP and set new password
    user.clear_otp()
    user.set_password(new_password)
    user.save()
    
    return Response({
        'message': 'Password changed successfully'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def disable_password(request):
    """Disable password login (requires current password verification)"""
    serializer = DisablePasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    user = request.user
    password = serializer.validated_data['password']
    
    # Check if user has password
    if not user.has_usable_password():
        return Response(
            {'error': 'Password is not set'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verify password before disabling
    if not user.check_password(password):
        return Response(
            {'error': 'Password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Set password to unusable state
    user.set_unusable_password()
    user.save()
    
    return Response({
        'message': 'Password disabled successfully'
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([UserRateThrottle])
def forgot_password(request):
    """Initiate password reset process"""
    serializer = ForgotPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    email = serializer.validated_data['email']
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Don't reveal if email exists - return success anyway
        return Response({
            'message': 'If an account exists with this email, a password reset link has been sent.'
        }, status=status.HTTP_200_OK)
    
    # Check if user has password enabled
    if not user.has_usable_password():
        # Don't reveal if password is enabled - return success anyway
        return Response({
            'message': 'If an account exists with this email, a password reset link has been sent.'
        }, status=status.HTTP_200_OK)
    
    # Generate reset token
    reset_token = ''.join([str(secrets.randbelow(10)) for _ in range(32)])
    user.set_password_reset_token(reset_token)
    
    # Create reset URL
    reset_url = f"{settings.FRONTEND_ORIGIN}/host/reset-password?token={reset_token}&email={email}"
    
    # Extract first name for greeting
    user_name = user.name or ''
    first_name = user_name.split()[0] if user_name and user_name.strip() else None
    greeting_name = first_name if first_name else 'there'
    
    subject = "Reset Your EkFern Password"
    message = f"""Hi {greeting_name},

You requested to reset your password for your EkFern account.

Click the link below to reset your password:
{reset_url}

This link will expire in 15 minutes. If you didn't request this, you can safely ignore this email.

— Team EkFern"""
    
    # Send email
    email_sent = False
    try:
        send_email(
            to_email=email,
            subject=subject,
            body_text=message,
        )
        email_sent = True
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f'Failed to send password reset email to {email}: {str(e)}')
    
    # In development mode, include token in response
    response_data = {
        'message': 'If an account exists with this email, a password reset link has been sent.'
    }
    
    if settings.DEBUG or not email_sent:
        response_data['reset_token'] = reset_token
        if not email_sent:
            response_data['_dev_note'] = 'Reset token included because email sending failed.'
        else:
            response_data['_dev_note'] = 'Reset token included only in development mode'
    
    return Response(response_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([UserRateThrottle])
def reset_password(request):
    """Reset password using reset token"""
    serializer = ResetPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    email = serializer.validated_data['email']
    token = serializer.validated_data['token']
    new_password = serializer.validated_data['new_password']
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response(
            {'error': 'Invalid reset token or email'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Verify reset token
    is_valid, error_message = user.verify_password_reset_token(token)
    if not is_valid:
        return Response(
            {'error': error_message},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Set new password
    user.set_password(new_password)
    user.clear_password_reset_token()
    user.clear_failed_password_attempts()  # Clear any lockouts
    user.save()
    
    return Response({
        'message': 'Password reset successfully. You can now login with your new password.'
    }, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Staff / Customer Support Endpoints
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAdminUser])
def staff_send_otp(request):
    """Staff: send OTP login email to any user to help them access their account."""
    serializer = OTPSendSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data['email']
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'No account found with this email.'}, status=status.HTTP_404_NOT_FOUND)

    NotificationLog.objects.create(
        channel='email',
        to=email,
        template='staff_otp_send',
        payload_json={'triggered_by': request.user.email},
        status='sent',
    )
    return _send_otp(user)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def staff_user_lookup(request):
    """Staff: get account snapshot for a user by email."""
    email = request.query_params.get('email', '').strip()
    if not email:
        return Response({'error': 'email query param is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.prefetch_related('events').get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response(StaffUserLookupSerializer(user).data)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def staff_unlock_account(request):
    """Staff: clear password lockout for a user."""
    serializer = OTPSendSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data['email']
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not user.is_account_locked():
        return Response({'message': 'Account is not locked.'}, status=status.HTTP_200_OK)

    user.clear_failed_password_attempts()

    NotificationLog.objects.create(
        channel='email',
        to=email,
        template='staff_account_unlock',
        payload_json={'unlocked_by': request.user.email},
        status='sent',
    )
    return Response({'message': f'Account unlocked for {email}.'})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def staff_set_account_active(request):
    """Staff: activate or deactivate a user account."""
    serializer = StaffSetActiveSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data['email']
    is_active = serializer.validated_data['is_active']
    reason = serializer.validated_data.get('reason', '')

    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if user.is_staff and not request.user.is_superuser:
        return Response(
            {'error': 'Only superusers can modify staff accounts.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    user.is_active = is_active
    user.save(update_fields=['is_active'])

    action_label = 'activated' if is_active else 'deactivated'
    NotificationLog.objects.create(
        channel='email',
        to=email,
        template=f'staff_account_{action_label}',
        payload_json={'by': request.user.email, 'reason': reason},
        status='sent',
    )
    return Response({'message': f'Account {action_label} for {email}.'})


@api_view(['POST'])
@permission_classes([IsAdminUser])
def staff_extend_event_expiry(request):
    """Staff: extend an event's expiry date."""
    serializer = StaffExtendExpirySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    slug = serializer.validated_data['event_slug']
    days = serializer.validated_data['extend_days']

    from apps.events.models import Event
    from datetime import date, timedelta

    try:
        event = Event.objects.select_related('host').get(slug=slug)
    except Event.DoesNotExist:
        return Response({'error': 'Event not found.'}, status=status.HTTP_404_NOT_FOUND)

    base_date = max(event.expiry_date or event.date or date.today(), date.today())
    event.expiry_date = base_date + timedelta(days=days)
    event.save()

    NotificationLog.objects.create(
        channel='email',
        to=event.host.email,
        template='staff_event_expiry_extended',
        payload_json={
            'by': request.user.email,
            'event_slug': slug,
            'new_expiry': event.expiry_date.isoformat(),
            'extend_days': days,
        },
        status='sent',
    )
    return Response({
        'message': f'Event "{event.title}" expiry extended by {days} day(s).',
        'new_expiry_date': event.expiry_date.isoformat(),
        'host_email': event.host.email,
    })


@api_view(['GET'])
@permission_classes([IsAdminUser])
def staff_order_lookup(request):
    """Staff: find all orders for a buyer email address."""
    buyer_email = request.query_params.get('buyer_email', '').strip()
    if not buyer_email:
        return Response({'error': 'buyer_email query param is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from apps.orders.models import Order

    orders = (
        Order.objects.filter(buyer_email__iexact=buyer_email)
        .select_related('event', 'item')
        .order_by('-created_at')[:50]
    )

    results = [
        {
            'id': o.id,
            'status': o.status,
            'amount_inr': o.amount_inr,
            'amount_rupees': round(o.amount_inr / 100, 2),
            'buyer_name': o.buyer_name,
            'buyer_email': o.buyer_email,
            'buyer_phone': o.buyer_phone,
            'event_slug': o.event.slug,
            'event_title': o.event.title,
            'item_name': o.item.name if o.item else None,
            'rzp_order_id': o.rzp_order_id,
            'rzp_payment_id': o.rzp_payment_id,
            'created_at': o.created_at.isoformat(),
        }
        for o in orders
    ]
    return Response({'results': results, 'count': len(results)})
