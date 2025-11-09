from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import RegistryItem
from .serializers import RegistryItemSerializer, RegistryItemCreateSerializer
from apps.events.models import Event


class RegistryItemViewSet(viewsets.ModelViewSet):
    serializer_class = RegistryItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get items for a specific event - strict privacy: only host's own events"""
        event_id = self.request.query_params.get('event_id')
        if event_id:
            # Strict check: event must belong to current user
            event = get_object_or_404(Event, id=event_id, host=self.request.user)
            # Return items only for this event (ownership already verified)
            return RegistryItem.objects.filter(event=event)
        return RegistryItem.objects.none()
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return RegistryItemCreateSerializer
        return RegistryItemSerializer
    
    def perform_create(self, serializer):
        """Create item - verify event ownership before saving"""
        event_id = self.request.data.get('event_id')
        # Strict check: event must belong to current user
        event = get_object_or_404(Event, id=event_id, host=self.request.user)
        serializer.save(event=event)
    
    def get_object(self):
        """Override to verify item ownership through event"""
        item = super().get_object()
        # Verify ownership through event - strict privacy check
        if item.event.host != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You can only access items from your own events.")
        return item
    
    def destroy(self, request, *args, **kwargs):
        """Delete item - verify ownership through event"""
        item = self.get_object()  # This already checks ownership
        # Additional explicit check for safety
        if item.event.host != request.user:
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

