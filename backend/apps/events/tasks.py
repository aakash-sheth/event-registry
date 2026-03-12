"""
Analytics tasks module.

The batch analytics pipeline (collect_page_view, process_analytics_batch,
scheduled_batch_processing) was removed in the direct-write migration (2026-03).
Analytics views are now written directly to the database via objects.create()
in the relevant view handlers. No background task is needed.

If you are looking for background task definitions for other features,
add them below this docstring.
"""
