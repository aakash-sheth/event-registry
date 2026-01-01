#!/bin/bash
# Check CloudWatch logs for slow requests in the last 3 days

LOG_GROUP="/ecs/event-registry-staging/backend"
DAYS_AGO=3

echo "🔍 Checking CloudWatch logs for slow requests (last $DAYS_AGO days)"
echo "======================================================================"
echo ""

# Calculate start time (3 days ago) - macOS compatible
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS date command
    START_TIME=$(($(date -u +%s) - ($DAYS_AGO * 86400)))000
else
    # Linux date command
    START_TIME=$(date -u -d "$DAYS_AGO days ago" +%s)000
fi

echo "📊 Searching for slow requests (>1 second)..."
echo ""

# Search for slow request warnings
aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --filter-pattern "SLOW REQUEST" \
    --max-items 50 \
    --query "events[*].[timestamp,message]" \
    --output table 2>/dev/null || {
    echo "⚠️  Could not fetch logs. Trying alternative method..."
    echo ""
    echo "Recent log streams:"
    aws logs describe-log-streams \
        --log-group-name "$LOG_GROUP" \
        --order-by LastEventTime \
        --descending \
        --max-items 5 \
        --query "logStreams[*].[logStreamName,lastEventTime]" \
        --output table
}

echo ""
echo "📊 Searching for 504 errors..."
echo ""

# Search for 504 errors
aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --filter-pattern "504" \
    --max-items 20 \
    --query "events[*].[timestamp,message]" \
    --output table 2>/dev/null || echo "No 504 errors found in logs"

echo ""
echo "📊 Searching for timeout errors..."
echo ""

# Search for timeout errors
aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$START_TIME" \
    --filter-pattern "timeout" \
    --max-items 20 \
    --query "events[*].[timestamp,message]" \
    --output table 2>/dev/null || echo "No timeout errors found"

echo ""
echo "✅ Log analysis complete"
echo ""
echo "To see live logs:"
echo "  aws logs tail $LOG_GROUP --follow"

