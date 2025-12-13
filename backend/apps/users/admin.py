from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.auth import authenticate
from django.contrib.auth.forms import AuthenticationForm
from django import forms
from django.utils.translation import gettext_lazy as _
from .models import User


class CustomAdminAuthenticationForm(AuthenticationForm):
    """
    Custom authentication form with better error messages
    """
    error_messages = {
        **AuthenticationForm.error_messages,
        'invalid_login': _(
            "Please enter a correct email and password. Note that both fields may be case-sensitive."
        ),
        'inactive': _("This account is inactive."),
    }

    def clean(self):
        email = self.cleaned_data.get('username')
        password = self.cleaned_data.get('password')

        if email is not None and password:
            # Try to authenticate with email
            self.user_cache = authenticate(
                self.request,
                username=email,
                password=password
            )
            if self.user_cache is None:
                # Check if user exists to provide more specific error message
                try:
                    user = User.objects.get(email=email)
                    if not user.is_active:
                        raise forms.ValidationError(
                            self.error_messages['inactive'],
                            code='inactive',
                        )
                    # User exists and is active but password is wrong
                    raise forms.ValidationError(
                        "The password you entered is incorrect. Please try again.",
                        code='invalid_login',
                    )
                except User.DoesNotExist:
                    # User doesn't exist
                    raise forms.ValidationError(
                        "No account found with this email address. Please check your email and try again.",
                        code='invalid_login',
                    )
            else:
                self.confirm_login_allowed(self.user_cache)

        return self.cleaned_data


class CustomAdminSite(AdminSite):
    """
    Custom admin site with improved authentication error messages
    """
    login_form = CustomAdminAuthenticationForm
    site_header = 'Event Registry Administration'
    site_title = 'Event Registry Admin'
    index_title = 'Welcome to Event Registry Administration'

    def login(self, request, extra_context=None):
        """
        Override login to provide better error messages and ensure proper redirect
        """
        extra_context = extra_context or {}
        extra_context['site_header'] = self.site_header
        extra_context['site_title'] = self.site_title
        
        # Ensure we stay on login page on error (don't redirect to homepage)
        response = super().login(request, extra_context)
        
        # If login failed, make sure we're still on the login page
        if request.method == 'POST' and not request.user.is_authenticated:
            # Login failed - response should already be the login page with errors
            pass
        
        return response


# Create custom admin site instance
admin_site = CustomAdminSite(name='customadmin')

# Register User model with custom admin site
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'is_active', 'is_staff', 'is_superuser', 'created_at')
    search_fields = ('email', 'name')
    list_filter = ('is_active', 'is_staff', 'is_superuser', 'created_at')
    readonly_fields = ('created_at',)

# Register explicitly to avoid decorator issues during autodiscover
admin_site.register(User, UserAdmin)
