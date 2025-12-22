from django.contrib import admin
from django.contrib.admin import AdminSite
from django.contrib.auth import authenticate
from django.contrib.auth.forms import AuthenticationForm
from django import forms
from django.utils.translation import gettext_lazy as _
from django.shortcuts import render
from django.urls import path
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
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
    
    def index(self, request, extra_context=None):
        """Override index to add custom views section"""
        from django.template.loader import render_to_string
        
        extra_context = extra_context or {}
        
        # Define custom admin views/paths
        custom_views = []
        if request.user.is_superuser:
            custom_views.append({
                'name': 'Analytics Dashboard',
                'url': '/api/admin/analytics/',
                'description': 'View comprehensive business metrics, user statistics, engagement data, revenue analytics, and geographic insights.',
                'icon': '📊'
            })
        
        extra_context['custom_admin_views'] = custom_views
        
        # Get the standard admin index response
        response = super().index(request, extra_context)
        
        # Render the response first to get the content
        if not response.is_rendered:
            response.render()
        
        # Render our custom content
        custom_content = render_to_string('admin/custom_index_content.html', {
            'custom_admin_views': custom_views,
        }, request=request)
        
        # Inject our content into the response
        if hasattr(response, 'content') and response.content:
            content = response.content.decode('utf-8')
            # Find the closing div of the content area and inject before it
            if '</div>\n    </div>\n</div>' in content:
                content = content.replace(
                    '</div>\n    </div>\n</div>',
                    custom_content + '</div>\n    </div>\n</div>'
                )
                response.content = content.encode('utf-8')
        
        return response
    
    def get_urls(self):
        """Add custom analytics view to admin URLs"""
        urls = super().get_urls()
        custom_urls = [
            path('analytics/', self.admin_view(self.analytics_view), name='analytics'),
        ]
        return custom_urls + urls
    
    def analytics_view(self, request):
        """
        Display analytics dashboard - supports both HTML and JSON responses.
        Returns HTML by default, JSON if Accept: application/json header or ?format=json
        """
        if not request.user.is_superuser:
            from django.contrib.auth.views import redirect_to_login
            return redirect_to_login(request.get_full_path())
        
        # Import models and analytics logic
        from apps.users.models import User
        from apps.events.models import Event, RSVP, Guest
        from apps.orders.models import Order
        from apps.items.models import RegistryItem
        from django.db.models import Count, Sum, Avg, Q, F
        from datetime import timedelta
        from django.utils import timezone
        from django.http import JsonResponse
        
        try:
            today = timezone.now().date()
            last_7_days = today - timedelta(days=7)
            last_30_days = today - timedelta(days=30)
            
            # User Metrics
            users = {
                'total': User.objects.count(),
                'new_last_7_days': User.objects.filter(created_at__date__gte=last_7_days).count(),
                'new_last_30_days': User.objects.filter(created_at__date__gte=last_30_days).count(),
                'verified': User.objects.filter(email_verified=True).count(),
                'with_events': User.objects.filter(events__isnull=False).distinct().count(),
            }
            
            # Event Metrics
            active_events = Event.objects.filter(
                Q(expiry_date__gte=today) | 
                Q(expiry_date__isnull=True, date__gte=today) |
                Q(expiry_date__isnull=True, date__isnull=True)
            )
            expired_events = Event.objects.filter(
                Q(expiry_date__lt=today) |
                Q(expiry_date__isnull=True, date__lt=today)
            )
            # Extended events: expiry_date exists and was updated after creation
            extended_events = Event.objects.exclude(expiry_date__isnull=True).filter(
                updated_at__gt=F('created_at')
            )
            
            events = {
                'total': Event.objects.count(),
                'active': active_events.count(),
                'expired': expired_events.count(),
                'created_last_7_days': Event.objects.filter(created_at__date__gte=last_7_days).count(),
                'created_last_30_days': Event.objects.filter(created_at__date__gte=last_30_days).count(),
                'by_type': list(Event.objects.values('event_type').annotate(count=Count('id'))),
                'public': Event.objects.filter(is_public=True).count(),
                'private': Event.objects.filter(is_public=False).count(),
                'with_rsvp': Event.objects.filter(has_rsvp=True).count(),
                'with_registry': Event.objects.filter(has_registry=True).count(),
                'extended': extended_events.count(),
            }
            
            # Engagement Metrics
            rsvps_yes = RSVP.objects.filter(will_attend='yes', is_removed=False)
            total_guests_attending = rsvps_yes.aggregate(Sum('guests_count'))['guests_count__sum'] or 0
            
            engagement = {
                'total_rsvps': RSVP.objects.filter(is_removed=False).count(),
                'rsvps_yes': rsvps_yes.count(),
                'rsvps_no': RSVP.objects.filter(will_attend='no', is_removed=False).count(),
                'rsvps_maybe': RSVP.objects.filter(will_attend='maybe', is_removed=False).count(),
                'total_guests_invited': Guest.objects.filter(is_removed=False).count(),
                'total_guests_attending': total_guests_attending,
                'active_registries': Event.objects.filter(items__isnull=False).distinct().count(),
                'total_items': RegistryItem.objects.count(),
                'items_purchased': RegistryItem.objects.aggregate(
                    total_purchased=Sum('qty_purchased')
                )['total_purchased'] or 0,
                'items_available': RegistryItem.objects.aggregate(
                    total_available=Sum(F('qty_total') - F('qty_purchased'))
                )['total_available'] or 0,
            }
            
            # Business Metrics
            paid_orders = Order.objects.filter(status='paid')
            total_revenue_paise = paid_orders.aggregate(Sum('amount_inr'))['amount_inr__sum'] or 0
            
            business = {
                'total_orders': Order.objects.count(),
                'paid_orders': paid_orders.count(),
                'total_revenue_paise': total_revenue_paise,
                'total_revenue_rupees': total_revenue_paise / 100,
                'avg_order_value_paise': paid_orders.aggregate(Avg('amount_inr'))['amount_inr__avg'] or 0,
                'avg_order_value_rupees': (paid_orders.aggregate(Avg('amount_inr'))['amount_inr__avg'] or 0) / 100,
                'orders_last_7_days': Order.objects.filter(created_at__date__gte=last_7_days).count(),
                'orders_last_30_days': Order.objects.filter(created_at__date__gte=last_30_days).count(),
                'events_with_orders': Event.objects.filter(orders__isnull=False).distinct().count(),
                'revenue_by_event_type': list(
                    Order.objects.filter(status='paid')
                    .values('event__event_type')
                    .annotate(revenue=Sum('amount_inr'))
                ),
            }
            
            # Geographic Metrics
            geographic = {
                'events_by_country': list(
                    Event.objects.values('country')
                    .annotate(count=Count('id'))
                    .order_by('-count')[:10]
                ),
                'top_cities': list(
                    Event.objects.exclude(city='')
                    .values('city')
                    .annotate(count=Count('id'))
                    .order_by('-count')[:10]
                ),
            }
            
            # Growth Trends - Daily data for last 30 days
            growth = {
                'hosts_daily': [
                    {
                        'date': (today - timedelta(days=i)).isoformat(),
                        'count': User.objects.filter(
                            created_at__date=(today - timedelta(days=i))
                        ).count()
                    }
                    for i in range(30, -1, -1)
                ],
                'events_daily': [
                    {
                        'date': (today - timedelta(days=i)).isoformat(),
                        'count': Event.objects.filter(
                            created_at__date=(today - timedelta(days=i))
                        ).count()
                    }
                    for i in range(30, -1, -1)
                ],
                'orders_daily': [
                    {
                        'date': (today - timedelta(days=i)).isoformat(),
                        'count': Order.objects.filter(
                            created_at__date=(today - timedelta(days=i))
                        ).count()
                    }
                    for i in range(30, -1, -1)
                ],
            }
            
            analytics_data = {
                'users': users,
                'events': events,
                'engagement': engagement,
                'business': business,
                'geographic': geographic,
                'growth': growth,
                'generated_at': timezone.now().isoformat(),
            }
        except Exception as e:
            import traceback
            analytics_data = {'error': str(e), 'traceback': traceback.format_exc()}
        
        # Check if JSON response is requested
        wants_json = (
            request.GET.get('format') == 'json' or
            'application/json' in request.META.get('HTTP_ACCEPT', '')
        )
        
        if wants_json:
            return JsonResponse(analytics_data, json_dumps_params={'indent': 2})
        
        # Return HTML response
        context = {
            **self.each_context(request),
            'title': 'Analytics Dashboard',
            'analytics': analytics_data,
        }
        
        return render(request, 'admin/analytics.html', context)


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
