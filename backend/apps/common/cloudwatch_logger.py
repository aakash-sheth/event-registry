"""
CloudWatch logging utility for structured logging
"""
import json
import logging
import boto3
from datetime import datetime
from django.conf import settings
from botocore.exceptions import ClientError

# Initialize CloudWatch Logs client
# Uses IAM role credentials in ECS, or explicit credentials if provided
def _get_cloudwatch_client():
    """Get CloudWatch Logs client with appropriate credentials"""
    kwargs = {
        'region_name': getattr(settings, 'AWS_REGION', 'us-east-1'),
    }
    
    # Only use explicit credentials if both are provided
    # Otherwise, use IAM role (recommended for ECS)
    aws_access_key_id = getattr(settings, 'AWS_ACCESS_KEY_ID', '')
    aws_secret_access_key = getattr(settings, 'AWS_SECRET_ACCESS_KEY', '')
    
    if aws_access_key_id and aws_secret_access_key:
        kwargs['aws_access_key_id'] = aws_access_key_id
        kwargs['aws_secret_access_key'] = aws_secret_access_key
    
    return boto3.client('logs', **kwargs)


def log_to_cloudwatch(
    message: str,
    level: str = 'INFO',
    log_group: str = '/ecs/event-registry-staging/backend',
    log_stream: str = 'application',
    extra_data: dict = None
):
    """
    Send log message to CloudWatch Logs
    
    Args:
        message: Log message
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_group: CloudWatch log group name
        log_stream: CloudWatch log stream name (defaults to 'application')
        extra_data: Additional data to include in log entry
    """
    try:
        client = _get_cloudwatch_client()
        
        # Create log stream if it doesn't exist
        try:
            client.create_log_stream(
                logGroupName=log_group,
                logStreamName=log_stream
            )
        except ClientError as e:
            # Stream might already exist, which is fine
            if e.response['Error']['Code'] != 'ResourceAlreadyExistsException':
                raise
        
        # Format log entry
        log_entry = {
            'timestamp': int(datetime.utcnow().timestamp() * 1000),  # CloudWatch expects milliseconds
            'message': message,
            'level': level,
        }
        
        if extra_data:
            log_entry['data'] = extra_data
        
        # Send log event
        client.put_log_events(
            logGroupName=log_group,
            logStreamName=log_stream,
            logEvents=[
                {
                    'timestamp': log_entry['timestamp'],
                    'message': json.dumps(log_entry),
                }
            ]
        )
    except Exception as e:
        # Fallback to Python logging if CloudWatch fails
        # This ensures we don't lose logs if CloudWatch is unavailable
        logger = logging.getLogger(__name__)
        logger.warning(f'Failed to send log to CloudWatch: {str(e)}')
        logger.log(
            getattr(logging, level.upper(), logging.INFO),
            f'[CloudWatch] {message}',
            extra=extra_data or {}
        )


class CloudWatchHandler(logging.Handler):
    """
    Python logging handler that sends logs to CloudWatch
    """
    def __init__(self, log_group: str = '/ecs/event-registry-staging/backend', log_stream: str = 'application'):
        super().__init__()
        self.log_group = log_group
        self.log_stream = log_stream
    
    def emit(self, record):
        """Emit a log record to CloudWatch"""
        try:
            # Format the log message
            message = self.format(record)
            
            # Map Python log levels to string levels
            level_map = {
                logging.DEBUG: 'DEBUG',
                logging.INFO: 'INFO',
                logging.WARNING: 'WARNING',
                logging.ERROR: 'ERROR',
                logging.CRITICAL: 'CRITICAL',
            }
            level = level_map.get(record.levelno, 'INFO')
            
            # Extract extra data if present
            extra_data = {}
            if hasattr(record, 'extra_data'):
                extra_data = record.extra_data
            
            log_to_cloudwatch(
                message=message,
                level=level,
                log_group=self.log_group,
                log_stream=self.log_stream,
                extra_data=extra_data if extra_data else None
            )
        except Exception:
            # Don't let CloudWatch logging errors break the application
            self.handleError(record)

