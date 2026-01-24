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
    
    def each_context(self, request):
        """
        Override to ensure site_url uses the current request's domain
        This ensures admin links work correctly on admin.ekfern.com subdomain
        """
        context = super().each_context(request)
        # Ensure site_url uses the current request's domain
        if 'site_url' in context and context['site_url']:
            # Use request's host to build site URL
            scheme = 'https' if request.is_secure() else 'http'
            context['site_url'] = f"{scheme}://{request.get_host()}/"
        return context

    def login(self, request, extra_context=None):
        """
        Override login to provide better error messages and ensure proper redirect
        """
        # If already authenticated, redirect to admin index (prevent redirect loops)
        if request.user.is_authenticated and request.path == '/api/admin/login/':
            from django.shortcuts import redirect
            return redirect('/api/admin/')
        
        extra_context = extra_context or {}
        extra_context['site_header'] = self.site_header
        extra_context['site_title'] = self.site_title
        
        # Ensure we stay on login page on error (don't redirect to homepage)
        response = super().login(request, extra_context)
        
        # If login failed, make sure we're still on the login page
        if request.method == 'POST' and not request.user.is_authenticated:
            # Login failed - response should already be the login page with errors
            pass
        
        # If login succeeded, ensure redirect goes to admin index, not homepage
        if request.method == 'POST' and request.user.is_authenticated:
            from django.shortcuts import redirect
            # Get the 'next' parameter or default to admin index
            next_url = request.GET.get('next') or request.POST.get('next', '/api/admin/')
            # Prevent redirect loops - if next is login page, go to admin index
            if next_url == '/api/admin/login/' or next_url.endswith('/api/admin/login/'):
                next_url = '/api/admin/'
            # Ensure next_url is within admin (security check)
            if not next_url or not next_url.startswith('/api/admin/'):
                next_url = '/api/admin/'
            return redirect(next_url)
        
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
            custom_views.append({
                'name': 'Analytics Batch Processing',
                'url': '/api/admin/analytics-batch/',
                'description': 'Monitor analytics batch processing status, view batch run history, and manually trigger batch processing.',
                'icon': '⚙️'
            })
            custom_views.append({
                'name': 'Analytics Cache Monitor',
                'url': '/api/admin/analytics-cache-monitor/',
                'description': 'Real-time monitoring of analytics cache to see pending page views before batch processing.',
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
        """Add custom analytics views to admin URLs"""
        urls = super().get_urls()
        custom_urls = [
            path('analytics/', self.admin_view(self.analytics_view), name='analytics'),
            path('analytics-batch/', self.admin_view(self.analytics_batch_view), name='analytics-batch'),
            path('analytics-cache-monitor/', self.admin_view(self.analytics_cache_monitor_view), name='analytics-cache-monitor'),
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
    
    def analytics_batch_view(self, request):
        """
        Display analytics batch processing monitoring dashboard
        Shows status of batch runs, statistics, and allows manual triggering
        """
        if not request.user.is_superuser:
            from django.contrib.auth.views import redirect_to_login
            return redirect_to_login(request.get_full_path())
        
        from django.shortcuts import render, redirect
        from apps.events.models import AnalyticsBatchRun
        from apps.events.tasks import process_analytics_batch
        from django.core.cache import cache
        from django.conf import settings
        from django.db.models import Avg, Sum
        from django.utils import timezone
        
        # Handle manual trigger
        if request.method == 'POST' and 'trigger_batch' in request.POST:
            try:
                batch_run = process_analytics_batch()
                if batch_run and batch_run.status == 'completed':
                    from django.contrib import messages
                    messages.success(request, f'Batch processed successfully: {batch_run.views_inserted} views inserted')
                elif batch_run and batch_run.status == 'failed':
                    from django.contrib import messages
                    messages.error(request, f'Batch processing failed: {batch_run.error_message}')
            except Exception as e:
                from django.contrib import messages
                messages.error(request, f'Error triggering batch: {str(e)}')
            return redirect('customadmin:analytics-batch')
        
        try:
            # Get recent batch runs
            recent_batches = AnalyticsBatchRun.objects.all().order_by('-started_at')[:50]
            
            # Summary statistics
            total_batches = AnalyticsBatchRun.objects.count()
            completed_batches = AnalyticsBatchRun.objects.filter(status='completed').count()
            failed_batches = AnalyticsBatchRun.objects.filter(status='failed').count()
            processing_batches = AnalyticsBatchRun.objects.filter(status='processing').count()
            
            success_rate = (completed_batches / total_batches * 100) if total_batches > 0 else 0
            
            # Average statistics from completed batches
            completed = AnalyticsBatchRun.objects.filter(status='completed')
            avg_stats = {}
            if completed.exists():
                avg_stats = {
                    'avg_collected': completed.aggregate(Avg('views_collected'))['views_collected__avg'] or 0,
                    'avg_inserted': completed.aggregate(Avg('views_inserted'))['views_inserted__avg'] or 0,
                    'avg_time_ms': completed.aggregate(Avg('processing_time_ms'))['processing_time_ms__avg'] or 0,
                }
            
            # Last successful run
            last_successful = AnalyticsBatchRun.objects.filter(status='completed').order_by('-processed_at').first()
            
            # Current pending views count (approximate from cache)
            cache_prefix = getattr(settings, 'ANALYTICS_BATCH_CACHE_PREFIX', 'analytics_pending')
            tracking_key = f"{cache_prefix}_keys"
            tracked_keys = cache.get(tracking_key, [])
            pending_views_count = len(tracked_keys) if tracked_keys else 0
            
            # Today's statistics
            today = timezone.now().date()
            today_batches = AnalyticsBatchRun.objects.filter(started_at__date=today)
            today_stats = {
                'total': today_batches.count(),
                'completed': today_batches.filter(status='completed').count(),
                'failed': today_batches.filter(status='failed').count(),
                'total_views': today_batches.filter(status='completed').aggregate(Sum('views_inserted'))['views_inserted__sum'] or 0,
            }
            
            # Batch interval setting
            batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
            
            context = {
                'title': 'Analytics Batch Processing Dashboard',
                'recent_batches': recent_batches,
                'summary': {
                    'total_batches': total_batches,
                    'completed_batches': completed_batches,
                    'failed_batches': failed_batches,
                    'processing_batches': processing_batches,
                    'success_rate': round(success_rate, 1),
                },
                'avg_stats': avg_stats,
                'last_successful': last_successful,
                'pending_views_count': pending_views_count,
                'today_stats': today_stats,
                'batch_interval': batch_interval,
            }
            
            return render(request, 'admin/analytics_batch.html', context)
            
        except Exception as e:
            from django.contrib import messages
            messages.error(request, f'Error loading batch dashboard: {str(e)}')
            context = {
                'title': 'Analytics Batch Processing Dashboard',
                'error': str(e),
            }
            return render(request, 'admin/analytics_batch.html', context)
    
    def analytics_cache_monitor_view(self, request):
        """
        Display real-time analytics cache monitoring
        Shows what views are currently pending in cache
        """
        if not request.user.is_superuser:
            from django.contrib.auth.views import redirect_to_login
            return redirect_to_login(request.get_full_path())
        
        from django.shortcuts import render
        from django.core.cache import cache
        from django.conf import settings
        from apps.events.models import Guest, Event
        import json
        
        cache_prefix = getattr(settings, 'ANALYTICS_BATCH_CACHE_PREFIX', 'analytics_pending')
        tracking_key = f"{cache_prefix}_keys"
        tracked_keys = cache.get(tracking_key, [])
        
        # Process tracked views
        pending_views = []
        invite_count = 0
        rsvp_count = 0
        event_counts = {}
        
        for key in tracked_keys:
            value = cache.get(key)
            if value:
                try:
                    view_data = json.loads(value)
                    view_type = view_data.get('view_type', 'unknown')
                    event_id = view_data.get('event_id')
                    guest_id = view_data.get('guest_id')
                    timestamp = view_data.get('timestamp', '')
                    
                    guest_name = "Unknown"
                    event_title = "Unknown"
                    try:
                        if guest_id:
                            guest = Guest.objects.get(id=guest_id)
                            guest_name = guest.name
                        if event_id:
                            event = Event.objects.get(id=event_id)
                            event_title = event.title
                    except Exception:
                        pass
                    
                    pending_views.append({
                        'key': key,
                        'guest_id': guest_id,
                        'guest_name': guest_name,
                        'event_id': event_id,
                        'event_title': event_title,
                        'view_type': view_type,
                        'timestamp': timestamp,
                    })
                    
                    if view_type == 'invite':
                        invite_count += 1
                    elif view_type == 'rsvp':
                        rsvp_count += 1
                    
                    if event_id:
                        event_counts[event_id] = event_counts.get(event_id, 0) + 1
                except Exception:
                    pass
        
        # Create a mapping of event_id to event_title for easy lookup
        event_titles = {}
        for view in pending_views:
            if view.get('event_id') and view.get('event_id') not in event_titles:
                event_titles[view['event_id']] = view.get('event_title', 'Unknown')
        
        # Create event_counts with titles included
        event_counts_with_titles = []
        for event_id, count in sorted(event_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            event_counts_with_titles.append({
                'event_id': event_id,
                'count': count,
                'title': event_titles.get(event_id, 'Unknown')
            })
        
        context = {
            'title': 'Analytics Cache Monitor',
            'total_views': len(tracked_keys),
            'invite_count': invite_count,
            'rsvp_count': rsvp_count,
            'unique_events': len(event_counts),
            'pending_views': pending_views[:50],  # Limit to 50 for display
            'event_counts': event_counts_with_titles,  # Now includes titles
            'cache_backend': settings.CACHES['default']['BACKEND'],
            'cache_prefix': cache_prefix,
        }
        
        return render(request, 'admin/analytics_cache_monitor.html', context)


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
