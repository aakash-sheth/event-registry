from django.urls import path
from .views import create_order, get_order

urlpatterns = [
    path('', create_order, name='create-order'),
    path('<int:order_id>', get_order, name='get-order'),
]

