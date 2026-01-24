# Analytics Batch Scheduling Setup

## Status Check

The auto-scheduling message you see is **expected behavior**:
- `backend` service: Auto-scheduling is **disabled** (correct - this service only runs the web server)
- `backend-worker` service: Auto-scheduling is **enabled** (this service handles background tasks)

## Verify Scheduled Tasks

To check if batch processing is scheduled, run this in the Django shell:

```bash
docker-compose exec backend-worker python manage.py shell
```

Then in the shell:
```python
from background_task.models import Task
tasks = Task.objects.filter(task_name__contains='scheduled_batch_processing')
print(f'Found {tasks.count()} scheduled task(s)')
for task in tasks[:5]:
    print(f'  - {task.task_name} scheduled for {task.run_at}')
```

Or use the management command:
```bash
docker-compose exec backend-worker python manage.py schedule_analytics_batch
```

This will show:
- ✅ If already scheduled: "Analytics batch processing already scheduled"
- ✅ If not scheduled: Will schedule it and show success message

## Manual Scheduling

If you need to manually schedule (or reschedule):

```bash
# Schedule (won't duplicate if already scheduled)
docker-compose exec backend-worker python manage.py schedule_analytics_batch

# Clear and reschedule
docker-compose exec backend-worker python manage.py schedule_analytics_batch --clear
```

## How It Works

1. **On startup**: `backend-worker` runs `schedule_analytics_batch` command
2. **First run**: Schedules the first batch processing task (default: 30 minutes from now)
3. **After processing**: The task automatically reschedules itself for the next interval
4. **Continuous**: `backend-worker` runs `process_tasks` to execute scheduled tasks

## Troubleshooting

### Check if backend-worker is running:
```bash
docker-compose ps backend-worker
```

### View backend-worker logs:
```bash
docker-compose logs backend-worker
```

### Restart backend-worker to reschedule:
```bash
docker-compose restart backend-worker
```

### Check batch run history:
```bash
docker-compose exec backend python manage.py process_analytics_batch --stats
```

Or visit the admin dashboard: `/api/admin/analytics-batch/`
