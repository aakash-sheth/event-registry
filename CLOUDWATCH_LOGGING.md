# CloudWatch Logging Setup

## Overview
Debug and error logs from both frontend and backend are now streamed to CloudWatch Logs for easy debugging in staging/production environments.

## How It Works

### Backend Logs
- **Automatic**: Python `logging` output (stdout/stderr) is automatically streamed to CloudWatch via ECS log driver
- **Log Group**: `/ecs/event-registry-staging/backend`
- **Structured Logging**: Use `apps.common.cloudwatch_logger.log_to_cloudwatch()` for structured logs with extra data

### Frontend Logs
- **Via API**: Frontend sends logs to backend API endpoint `/api/logs/cloudwatch`
- **Backend forwards to CloudWatch**: Logs are written to CloudWatch Logs
- **Log Group**: `/ecs/event-registry-staging/frontend`
- **Automatic**: `logDebug()` and `logError()` functions automatically send to CloudWatch in production/staging

## Usage

### Frontend
```typescript
import { logDebug, logError } from '@/lib/error-handler'

// Debug logs (sent to CloudWatch in staging/production)
logDebug('Event data loaded:', { eventId, tilesCount: 5 })

// Error logs (sent to CloudWatch in staging/production)
logError('Failed to load data:', error)
```

### Backend
```python
from apps.common.cloudwatch_logger import log_to_cloudwatch

# Send structured log to CloudWatch
log_to_cloudwatch(
    message='Tile loading completed',
    level='INFO',
    extra_data={'tiles_count': 5, 'event_id': 123}
)
```

## Viewing Logs

### AWS Console
1. Go to CloudWatch → Log groups
2. Select `/ecs/event-registry-staging/backend` or `/ecs/event-registry-staging/frontend`
3. View log streams and search logs

### AWS CLI
```bash
# View backend logs
aws logs tail /ecs/event-registry-staging/backend --follow

# View frontend logs
aws logs tail /ecs/event-registry-staging/frontend --follow

# Search for specific messages
aws logs filter-log-events \
  --log-group-name /ecs/event-registry-staging/backend \
  --filter-pattern "tiles"
```

## IAM Permissions
The backend task role has been updated with CloudWatch Logs permissions:
- `logs:CreateLogStream`
- `logs:PutLogEvents`

## Notes
- Logs are only sent to CloudWatch in staging/production (not in local development)
- Local development still uses console logs for easier debugging
- CloudWatch logging failures are silently handled to prevent breaking the application
- Log retention is set to 14 days (configured in CloudWatch Log Groups)

