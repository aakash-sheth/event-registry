from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    signup, otp_start, otp_verify, me,
    check_password_enabled, password_login,
    set_password, change_password, disable_password,
    forgot_password, reset_password,
    staff_send_otp, staff_user_lookup, staff_unlock_account,
    staff_set_account_active, staff_extend_event_expiry, staff_order_lookup,
)

urlpatterns = [
    path('signup/', signup, name='signup'),
    path('otp/start/', otp_start, name='otp_start'),
    path('otp/verify/', otp_verify, name='otp_verify'),
    path('me/', me, name='me'),
    # Password endpoints
    path('check-password-enabled/', check_password_enabled, name='check_password_enabled'),
    path('password-login/', password_login, name='password_login'),
    path('set-password/', set_password, name='set_password'),
    path('change-password/', change_password, name='change_password'),
    path('disable-password/', disable_password, name='disable_password'),
    path('forgot-password/', forgot_password, name='forgot_password'),
    path('reset-password/', reset_password, name='reset_password'),
    # JWT Token refresh endpoint
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Staff / Customer Support endpoints
    path('staff/send-otp/', staff_send_otp, name='staff_send_otp'),
    path('staff/user-lookup/', staff_user_lookup, name='staff_user_lookup'),
    path('staff/unlock-account/', staff_unlock_account, name='staff_unlock_account'),
    path('staff/set-account-active/', staff_set_account_active, name='staff_set_account_active'),
    path('staff/extend-event-expiry/', staff_extend_event_expiry, name='staff_extend_event_expiry'),
    path('staff/order-lookup/', staff_order_lookup, name='staff_order_lookup'),
]

