from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import signup, otp_start, otp_verify, me

urlpatterns = [
    path('signup/', signup, name='signup'),
    path('otp/start/', otp_start, name='otp_start'),
    path('otp/verify/', otp_verify, name='otp_verify'),
    path('me/', me, name='me'),
    # JWT Token refresh endpoint
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

