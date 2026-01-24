"""
Batch analytics collection system
Collects page views in cache and processes them in batches to reduce database load
"""
import logging
import json
import uuid
from django.utils import timezone
from datetime import timedelta
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)

# Import models conditionally
try:
    from .models import Guest, InvitePageView, RSVPPageView, Event, AnalyticsBatchRun
    MODELS_AVAILABLE = True
except Exception:
    MODELS_AVAILABLE = False
    Guest = InvitePageView = RSVPPageView = Event = AnalyticsBatchRun = None


def collect_page_view(guest_token: str, event_id: int, view_type: str = 'invite'):
    """
    Collect a page view in cache for batch processing.
    This is synchronous and very fast (in-memory cache write).
    
    Args:
        guest_token: The guest token from URL query parameter
        event_id: The event ID
        view_type: 'invite' or 'rsvp'
    
    Returns:
        True if view was collected, False if guest not found or error
    """
    if not MODELS_AVAILABLE:
        logger.debug("[Batch Analytics] Models not available, skipping collection")
        return False
    
    try:
        # Resolve guest token to guest (lightweight query)
        try:
            guest = Guest.objects.only('id', 'event_id').get(
                guest_token=guest_token,
                is_removed=False
            )
        except Guest.DoesNotExist:
            logger.debug(
                f"[Batch Analytics] Guest not found for token: {guest_token[:8]}... (event_id: {event_id})"
            )
            return False
        
        # Verify event matches (security check)
        if guest.event_id != event_id:
            logger.warning(
                f"[Batch Analytics] Event mismatch for guest {guest.id}: "
                f"token event={guest.event_id}, provided event={event_id}"
            )
            return False
        
        # Get batch collection settings
        batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
        cache_prefix = getattr(settings, 'ANALYTICS_BATCH_CACHE_PREFIX', 'analytics_pending')
        
        # Create cache key: prefix:guest_id:event_id:view_type:timestamp
        # Using timestamp ensures we can track multiple views and deduplicate later
        timestamp = timezone.now()
        timestamp_str = timestamp.isoformat()
        cache_key = f"{cache_prefix}:{guest.id}:{event_id}:{view_type}:{timestamp_str}"
        
        # Store view data in cache
        view_data = {
            'guest_id': guest.id,
            'event_id': event_id,
            'view_type': view_type,
            'timestamp': timestamp_str,
        }
        
        # TTL: batch_interval + 5 minutes buffer to ensure we don't lose data
        ttl_seconds = (batch_interval + 5) * 60
        
        try:
            cache.set(cache_key, json.dumps(view_data), ttl_seconds)
            
            # Track keys for non-Redis backends (LocMemCache, etc.)
            # This allows us to retrieve all keys later
            tracking_key = f"{cache_prefix}_keys"
            tracked_keys = cache.get(tracking_key, [])
            if not isinstance(tracked_keys, list):
                tracked_keys = list(tracked_keys) if tracked_keys else []
            
            # Add key if not already in list
            if cache_key not in tracked_keys:
                tracked_keys.append(cache_key)
                # Store the list back (with same TTL)
                cache.set(tracking_key, tracked_keys, ttl_seconds)
                logger.info(
                    f"[Batch Analytics] Collected {view_type} view: guest_id={guest.id}, event_id={event_id}, "
                    f"cache_key={cache_key}, total_tracked={len(tracked_keys)}"
                )
            else:
                logger.debug(
                    f"[Batch Analytics] View already tracked: guest_id={guest.id}, event_id={event_id}, cache_key={cache_key}"
                )
            
            return True
        except Exception as cache_error:
            logger.error(
                f"[Batch Analytics] Failed to write to cache: {str(cache_error)}",
                exc_info=True
            )
            return False
        
    except Exception as e:
        # Log error but don't raise - tracking failures shouldn't break anything
        logger.error(
            f"[Batch Analytics] Error collecting page view: {str(e)}",
            exc_info=True,
            extra={
                'guest_token_prefix': guest_token[:8] if guest_token else None,
                'event_id': event_id,
                'view_type': view_type,
            }
        )
        return False


def process_analytics_batch():
    """
    Process all pending analytics views from cache.
    This function:
    1. Collects all pending views from cache
    2. Deduplicates by (guest_id, event_id, view_type)
    3. Bulk inserts to database
    4. Creates BatchRun record with statistics
    
    This should be called periodically (every N minutes) via scheduled task.
    """
    if not MODELS_AVAILABLE:
        logger.error("[Batch Analytics] Models not available, cannot process batch")
        return None
    
    start_time = timezone.now()
    run_id = f"batch_{start_time.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
    cache_prefix = getattr(settings, 'ANALYTICS_BATCH_CACHE_PREFIX', 'analytics_pending')
    
    # Create batch run record
    batch_run = None
    try:
        batch_run = AnalyticsBatchRun.objects.create(
            run_id=run_id,
            started_at=start_time - timedelta(minutes=batch_interval),
            status='processing',
        )
    except Exception as e:
        logger.error(f"[Batch Analytics] Failed to create batch run record: {str(e)}")
        return None
    
    try:
        # Get cache backend to scan keys (if supported)
        # Note: LocMemCache doesn't support key scanning, Redis does
        cache_backend = settings.CACHES['default']['BACKEND']
        
        # Collect all pending views from cache
        pending_views = []
        processed_keys = []  # Track which keys we actually processed (for both Redis and LocMemCache)
        
        if 'RedisCache' in cache_backend or 'redis' in cache_backend.lower():
            # Redis supports key scanning
            try:
                import redis
                redis_client = cache.get_master_client()
                pattern = f"{cache_prefix}:*"
                keys = []
                cursor = 0
                while True:
                    cursor, batch_keys = redis_client.scan(cursor, match=pattern, count=1000)
                    keys.extend(batch_keys)
                    if cursor == 0:
                        break
                
                # Fetch all values and track which keys we processed
                for key in keys:
                    try:
                        value = cache.get(key)
                        if value:
                            view_data = json.loads(value)
                            pending_views.append(view_data)
                            processed_keys.append(key)  # Track which keys we successfully processed
                    except Exception as e:
                        logger.warning(f"[Batch Analytics] Failed to parse cache value for {key}: {str(e)}")
                        continue
            except Exception as e:
                logger.error(f"[Batch Analytics] Redis key scanning failed: {str(e)}")
                # Fallback: we can't scan, but we can still process if we track keys differently
                pending_views = []
        else:
            # For LocMemCache or other backends without key scanning
            # Use the tracking list we maintain
            tracking_key = f"{cache_prefix}_keys"
            tracked_keys = cache.get(tracking_key, [])
            if tracked_keys:
                logger.info(f"[Batch Analytics] Using tracked keys: {len(tracked_keys)} keys found")
                stale_keys = []
                for key in tracked_keys:
                    try:
                        value = cache.get(key)
                        if value:
                            view_data = json.loads(value)
                            pending_views.append(view_data)
                            processed_keys.append(key)  # Track which keys we successfully processed
                        else:
                            stale_keys.append(key)
                    except Exception as e:
                        logger.warning(f"[Batch Analytics] Failed to get cache value for {key}: {str(e)}")
                        stale_keys.append(key)
                        continue
                
                # Clean up stale keys immediately so cache monitor reflects reality
                if stale_keys:
                    remaining_keys = [k for k in tracked_keys if k not in stale_keys]
                    batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
                    ttl_seconds = (batch_interval + 5) * 60
                    if remaining_keys:
                        cache.set(tracking_key, remaining_keys, ttl_seconds)
                        logger.info(
                            f"[Batch Analytics] Cleaned {len(stale_keys)} stale keys from tracking list, "
                            f"{len(remaining_keys)} keys remaining"
                        )
                    else:
                        cache.delete(tracking_key)
                        logger.info("[Batch Analytics] Cleaned all stale keys, tracking list cleared")
        
        views_collected = len(pending_views)
        logger.info(f"[Batch Analytics] Collected {views_collected} pending views from cache")
        
        if views_collected == 0:
            # No views to process
            batch_run.status = 'completed'
            batch_run.processed_at = timezone.now()
            batch_run.processing_time_ms = int((timezone.now() - start_time).total_seconds() * 1000)
            batch_run.save()
            return batch_run
        
        # Deduplicate: Group by (guest_id, event_id, view_type) and keep only first timestamp
        deduplicated_views = {}
        for view in pending_views:
            key = (view['guest_id'], view['event_id'], view['view_type'])
            if key not in deduplicated_views:
                deduplicated_views[key] = view
            else:
                # Keep the earliest timestamp
                existing_timestamp = deduplicated_views[key]['timestamp']
                new_timestamp = view['timestamp']
                if new_timestamp < existing_timestamp:
                    deduplicated_views[key] = view
        
        views_deduplicated = len(deduplicated_views)
        logger.info(f"[Batch Analytics] Deduplicated to {views_deduplicated} unique views")
        
        # Separate invite and RSVP views
        invite_views = []
        rsvp_views = []
        
        for view in deduplicated_views.values():
            if view['view_type'] == 'invite':
                invite_views.append(view)
            elif view['view_type'] == 'rsvp':
                rsvp_views.append(view)
        
        # Bulk create invite views
        invite_objects = []
        for view in invite_views:
            try:
                guest = Guest.objects.get(id=view['guest_id'], is_removed=False)
                event = Event.objects.get(id=view['event_id'])
                # Parse ISO timestamp - Django's timezone handles ISO format
                timestamp_str = view['timestamp']
                if timestamp_str.endswith('Z'):
                    timestamp_str = timestamp_str.replace('Z', '+00:00')
                from datetime import datetime
                viewed_at = datetime.fromisoformat(timestamp_str)
                if timezone.is_naive(viewed_at):
                    viewed_at = timezone.make_aware(viewed_at)
                invite_objects.append(InvitePageView(
                    guest=guest,
                    event=event,
                    viewed_at=viewed_at
                ))
            except (Guest.DoesNotExist, Event.DoesNotExist) as e:
                logger.warning(f"[Batch Analytics] Guest or Event not found: {str(e)}")
                continue
        
        # Bulk create RSVP views
        rsvp_objects = []
        for view in rsvp_views:
            try:
                guest = Guest.objects.get(id=view['guest_id'], is_removed=False)
                event = Event.objects.get(id=view['event_id'])
                # Parse ISO timestamp - Django's timezone handles ISO format
                timestamp_str = view['timestamp']
                if timestamp_str.endswith('Z'):
                    timestamp_str = timestamp_str.replace('Z', '+00:00')
                from datetime import datetime
                viewed_at = datetime.fromisoformat(timestamp_str)
                if timezone.is_naive(viewed_at):
                    viewed_at = timezone.make_aware(viewed_at)
                rsvp_objects.append(RSVPPageView(
                    guest=guest,
                    event=event,
                    viewed_at=viewed_at
                ))
            except (Guest.DoesNotExist, Event.DoesNotExist) as e:
                logger.warning(f"[Batch Analytics] Guest or Event not found: {str(e)}")
                continue
        
        # Bulk insert
        views_inserted = 0
        if invite_objects:
            InvitePageView.objects.bulk_create(invite_objects, ignore_conflicts=True)
            views_inserted += len(invite_objects)
        
        if rsvp_objects:
            RSVPPageView.objects.bulk_create(rsvp_objects, ignore_conflicts=True)
            views_inserted += len(rsvp_objects)
        
        # Clear processed cache entries (only the ones we actually processed)
        if 'RedisCache' in cache_backend or 'redis' in cache_backend.lower():
            # For Redis: Only delete the keys we actually processed (not all keys)
            if processed_keys:
                try:
                    cache.delete_many(processed_keys)
                    logger.debug(f"[Batch Analytics] Cleared {len(processed_keys)} processed Redis cache keys")
                except Exception as e:
                    logger.warning(f"[Batch Analytics] Failed to clear processed cache entries: {str(e)}")
        else:
            # For LocMemCache: Delete processed keys and update tracking list to keep new keys
            if processed_keys:
                tracking_key = f"{cache_prefix}_keys"
                # Delete processed keys from cache
                for key in processed_keys:
                    cache.delete(key)
                
                # Update tracking list: remove only processed keys, keep new ones
                tracked_keys = cache.get(tracking_key, [])
                if tracked_keys:
                    # Remove processed keys from tracking list (keep new ones that were added during processing)
                    remaining_keys = [k for k in tracked_keys if k not in processed_keys]
                    if remaining_keys:
                        # Update tracking list with remaining keys
                        batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
                        ttl_seconds = (batch_interval + 5) * 60
                        cache.set(tracking_key, remaining_keys, ttl_seconds)
                        logger.debug(f"[Batch Analytics] Updated tracking list: removed {len(processed_keys)} processed keys, kept {len(remaining_keys)} new keys")
                    else:
                        # No remaining keys, clear the tracking list
                        cache.delete(tracking_key)
                        logger.debug(f"[Batch Analytics] Cleared tracking list (no remaining keys)")
                logger.debug(f"[Batch Analytics] Cleared {len(processed_keys)} processed cache keys")
        
        # Update batch run record
        processing_time = (timezone.now() - start_time).total_seconds() * 1000
        
        batch_run.status = 'completed'
        batch_run.processed_at = timezone.now()
        batch_run.views_collected = views_collected
        batch_run.views_deduplicated = views_deduplicated
        batch_run.views_inserted = views_inserted
        batch_run.invite_views_count = len(invite_objects)
        batch_run.rsvp_views_count = len(rsvp_objects)
        batch_run.processing_time_ms = int(processing_time)
        batch_run.metadata = {
            'deduplication_rate': round((1 - views_deduplicated / views_collected) * 100, 2) if views_collected > 0 else 0,
            'cache_backend': cache_backend,
        }
        batch_run.save()
        
        logger.info(
            f"[Batch Analytics] Batch {run_id} completed: "
            f"collected={views_collected}, deduplicated={views_deduplicated}, inserted={views_inserted}, "
            f"time={processing_time:.0f}ms"
        )
        
        return batch_run
        
    except Exception as e:
        # Mark batch run as failed
        error_msg = str(e)
        logger.error(
            f"[Batch Analytics] Batch {run_id} failed: {error_msg}",
            exc_info=True
        )
        
        if batch_run:
            batch_run.status = 'failed'
            batch_run.processed_at = timezone.now()
            batch_run.error_message = error_msg
            batch_run.processing_time_ms = int((timezone.now() - start_time).total_seconds() * 1000)
            batch_run.save()
        
        return batch_run


# Legacy functions for backward compatibility (deprecated, use collect_page_view instead)
# Import background_task conditionally
try:
    from background_task import background
    BACKGROUND_TASKS_AVAILABLE = True
except ImportError:
    BACKGROUND_TASKS_AVAILABLE = False
    def background(schedule=0):
        def decorator(func):
            return func
        return decorator

@background(schedule=0)
def track_invite_page_view(guest_token: str, event_id: int):
    """
    DEPRECATED: Use collect_page_view() instead.
    This function is kept for backward compatibility.
    """
    collect_page_view(guest_token, event_id, view_type='invite')


@background(schedule=0)
def track_rsvp_page_view(guest_token: str, event_id: int):
    """
    DEPRECATED: Use collect_page_view() instead.
    This function is kept for backward compatibility.
    """
    collect_page_view(guest_token, event_id, view_type='rsvp')
