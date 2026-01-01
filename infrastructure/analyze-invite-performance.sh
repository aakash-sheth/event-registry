#!/bin/bash
set -e

# Script to analyze invite page performance issues in production
# This will run diagnostic queries on the production database

PARAM_PREFIX="/event-registry-staging"
CLUSTER_NAME="event-registry-staging"
SERVICE_NAME="backend-service"

echo "🔍 Invite Page Performance Analysis"
echo "===================================="
echo ""

# Get cluster and service info
echo "📋 Getting ECS service information..."
SERVICE_ARN=$(aws ecs list-services --cluster "$CLUSTER_NAME" --query "serviceArns[?contains(@, '$SERVICE_NAME')]" --output text | head -1)

if [ -z "$SERVICE_ARN" ]; then
    echo "❌ Could not find service: $SERVICE_NAME"
    exit 1
fi

echo "✅ Found service: $SERVICE_ARN"
echo ""

# Get running task
echo "📋 Getting running task..."
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --service-name "$SERVICE_NAME" --desired-status RUNNING --query "taskArns[0]" --output text)

if [ -z "$TASK_ARN" ]; then
    echo "❌ No running tasks found for service"
    exit 1
fi

echo "✅ Found task: $TASK_ARN"
echo ""

# Get task details for network config
echo "📋 Getting task network configuration..."
TASK_DETAILS=$(aws ecs describe-tasks --cluster "$CLUSTER_NAME" --tasks "$TASK_ARN" --query "tasks[0]" --output json)
SUBNET_ID=$(echo "$TASK_DETAILS" | jq -r '.attachments[0].details[] | select(.name=="subnetId") | .value' | head -1)
SECURITY_GROUP=$(echo "$TASK_DETAILS" | jq -r '.attachments[0].details[] | select(.name=="securityGroupId") | .value' | head -1)

if [ -z "$SUBNET_ID" ] || [ -z "$SECURITY_GROUP" ]; then
    echo "⚠️  Could not get network config, trying alternative method..."
    # Try to get from service
    SERVICE_DETAILS=$(aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query "services[0]" --output json)
    SUBNET_ID=$(echo "$SERVICE_DETAILS" | jq -r '.networkConfiguration.awsvpcConfiguration.subnets[0]' 2>/dev/null || echo "")
    SECURITY_GROUP=$(echo "$SERVICE_DETAILS" | jq -r '.networkConfiguration.awsvpcConfiguration.securityGroups[0]' 2>/dev/null || echo "")
fi

echo "   Subnet: $SUBNET_ID"
echo "   Security Group: $SECURITY_GROUP"
echo ""

# Create Python script for database analysis
PYTHON_SCRIPT=$(cat <<'PYTHON_EOF'
import os
import sys
import django
import json
from datetime import datetime, timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'registry_backend.settings')
django.setup()

from django.db import connection
from apps.events.models import InvitePage, Event, SubEvent, GuestSubEventInvite

print("=" * 80)
print("DATABASE PERFORMANCE ANALYSIS")
print("=" * 80)
print()

# 1. Check if migration 0024 index exists
print("1️⃣  CHECKING INDEXES")
print("-" * 80)
with connection.cursor() as cursor:
    # Check invite_pages indexes
    cursor.execute("""
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'invite_pages'
        ORDER BY indexname;
    """)
    invite_indexes = cursor.fetchall()
    print(f"📊 InvitePage indexes ({len(invite_indexes)} total):")
    for idx_name, idx_def in invite_indexes:
        print(f"   - {idx_name}")
        if 'invite_slug_pub_idx' in idx_name:
            print(f"     ✅ CRITICAL INDEX FOUND: {idx_name}")
            print(f"     Definition: {idx_def}")
    
    # Check if the critical index exists
    cursor.execute("""
        SELECT COUNT(*) 
        FROM pg_indexes 
        WHERE tablename = 'invite_pages' 
        AND indexname = 'invite_slug_pub_idx';
    """)
    has_index = cursor.fetchone()[0] > 0
    if not has_index:
        print("   ❌ CRITICAL: invite_slug_pub_idx index is MISSING!")
        print("   ⚠️  This is likely causing slow queries!")
    print()
    
    # Check sub_events indexes
    cursor.execute("""
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'sub_events'
        ORDER BY indexname;
    """)
    sub_event_indexes = cursor.fetchall()
    print(f"📊 SubEvent indexes ({len(sub_event_indexes)} total):")
    for idx_name, idx_def in sub_event_indexes:
        print(f"   - {idx_name}")
    print()
    
    # Check for recommended indexes
    cursor.execute("""
        SELECT COUNT(*) 
        FROM pg_indexes 
        WHERE tablename = 'sub_events' 
        AND indexdef LIKE '%is_public_visible%'
        AND indexdef LIKE '%is_removed%';
    """)
    has_sub_event_index = cursor.fetchone()[0] > 0
    if not has_sub_event_index:
        print("   ⚠️  Missing index on (event_id, is_public_visible, is_removed)")
        print("   This could slow down sub-events queries")
    print()

# 2. Check table sizes
print("2️⃣  TABLE SIZES")
print("-" * 80)
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
            pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename IN ('invite_pages', 'events', 'sub_events', 'guest_sub_event_invites', 'guests')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    """)
    sizes = cursor.fetchall()
    for schema, table, size, size_bytes in sizes:
        print(f"   {table:30} {size:15} ({size_bytes:,} bytes)")
    print()

# 3. Check row counts
print("3️⃣  ROW COUNTS")
print("-" * 80)
print(f"   Events:                    {Event.objects.count():,}")
print(f"   InvitePages:               {InvitePage.objects.count():,}")
print(f"   Published InvitePages:    {InvitePage.objects.filter(is_published=True).count():,}")
print(f"   Unpublished InvitePages:  {InvitePage.objects.filter(is_published=False).count():,}")
print(f"   SubEvents:                 {SubEvent.objects.count():,}")
print(f"   Public SubEvents:          {SubEvent.objects.filter(is_public_visible=True, is_removed=False).count():,}")
print(f"   GuestSubEventInvites:      {GuestSubEventInvite.objects.count():,}")
print()

# 4. Check for slow query patterns
print("4️⃣  QUERY PERFORMANCE ANALYSIS")
print("-" * 80)

# Test the exact query used in the view
test_slug = "envolope-test1"
print(f"Testing query for slug: {test_slug}")
print()

# Test 1: InvitePage lookup with index
print("Test 1: InvitePage lookup (slug + is_published)")
with connection.cursor() as cursor:
    cursor.execute("EXPLAIN ANALYZE SELECT * FROM invite_pages WHERE slug = %s AND is_published = true;", [test_slug])
    result = cursor.fetchall()
    for row in result:
        print(f"   {row[0]}")
print()

# Test 2: Event lookup
print("Test 2: Event lookup by slug")
with connection.cursor() as cursor:
    cursor.execute("EXPLAIN ANALYZE SELECT id, slug, page_config, event_structure, title, description, date, has_rsvp, has_registry FROM events WHERE slug = %s;", [test_slug])
    result = cursor.fetchall()
    for row in result:
        print(f"   {row[0]}")
print()

# Test 3: SubEvents query (public)
print("Test 3: SubEvents query (public, not removed)")
# Get event ID first
try:
    event = Event.objects.get(slug=test_slug)
    with connection.cursor() as cursor:
        cursor.execute("""
            EXPLAIN ANALYZE 
            SELECT id, title, start_at, end_at, location, description, image_url, rsvp_enabled 
            FROM sub_events 
            WHERE event_id = %s AND is_public_visible = true AND is_removed = false 
            ORDER BY start_at;
        """, [event.id])
        result = cursor.fetchall()
        for row in result:
            print(f"   {row[0]}")
except Event.DoesNotExist:
    print(f"   ⚠️  Event with slug '{test_slug}' not found, skipping sub-events test")
print()

# 5. Check for missing invite pages
print("5️⃣  INVITE PAGE STATUS")
print("-" * 80)
events_without_invite = Event.objects.filter(invite_page__isnull=True).count()
events_with_invite = Event.objects.filter(invite_page__isnull=False).count()
print(f"   Events without InvitePage:  {events_without_invite:,}")
print(f"   Events with InvitePage:    {events_with_invite:,}")
if events_without_invite > 0:
    print(f"   ⚠️  {events_without_invite} events will trigger get_or_create on first access")
print()

# 6. Check database connection settings
print("6️⃣  DATABASE CONNECTION SETTINGS")
print("-" * 80)
from django.conf import settings
db_config = settings.DATABASES['default']
print(f"   Engine:        {db_config.get('ENGINE', 'N/A')}")
print(f"   Host:          {db_config.get('HOST', 'N/A')}")
print(f"   Port:          {db_config.get('PORT', 'N/A')}")
print(f"   Name:          {db_config.get('NAME', 'N/A')}")
print(f"   CONN_MAX_AGE:  {db_config.get('CONN_MAX_AGE', 'Not set (default: 0)')}")
if 'OPTIONS' in db_config:
    print(f"   OPTIONS:       {db_config.get('OPTIONS', {})}")
else:
    print(f"   OPTIONS:       Not set (no connection pooling)")
print()

# 7. Check recent slow queries (if pg_stat_statements is enabled)
print("7️⃣  RECOMMENDATIONS")
print("-" * 80)
with connection.cursor() as cursor:
    # Check if migration 0024 index exists
    cursor.execute("""
        SELECT COUNT(*) 
        FROM pg_indexes 
        WHERE tablename = 'invite_pages' 
        AND indexname = 'invite_slug_pub_idx';
    """)
    has_index = cursor.fetchone()[0] > 0
    
    if not has_index:
        print("   ❌ URGENT: Apply migration 0024 to add invite_slug_pub_idx index")
        print("      Run: python manage.py migrate events")
    
    # Check for sub-events index
    cursor.execute("""
        SELECT COUNT(*) 
        FROM pg_indexes 
        WHERE tablename = 'sub_events' 
        AND (indexdef LIKE '%is_public_visible%' AND indexdef LIKE '%is_removed%');
    """)
    has_sub_index = cursor.fetchone()[0] > 0
    
    if not has_sub_index:
        print("   ⚠️  Consider adding index on sub_events (event_id, is_public_visible, is_removed)")
    
    # Check connection pooling
    if db_config.get('CONN_MAX_AGE', 0) == 0:
        print("   ⚠️  Consider enabling connection pooling (CONN_MAX_AGE)")
    
    # Check table sizes
    cursor.execute("""
        SELECT pg_total_relation_size('invite_pages') + pg_total_relation_size('sub_events');
    """)
    total_size = cursor.fetchone()[0]
    if total_size > 100 * 1024 * 1024:  # > 100MB
        print(f"   ⚠️  Large table sizes detected ({total_size / 1024 / 1024:.1f} MB)")
        print("      Consider adding more indexes or optimizing queries")

print()
print("=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
PYTHON_EOF
)

# Save script to temp file
TEMP_SCRIPT="/tmp/analyze_invite_perf_${RANDOM}.py"
echo "$PYTHON_SCRIPT" > "$TEMP_SCRIPT"

echo "📊 Running database analysis..."
echo ""

# Run the analysis script on the ECS task
if [ -n "$SUBNET_ID" ] && [ -n "$SECURITY_GROUP" ]; then
    # Use execute-command if available
    echo "Running analysis via ECS execute-command..."
    aws ecs execute-command \
        --cluster "$CLUSTER_NAME" \
        --task "$TASK_ARN" \
        --container backend \
        --command "python -c \"$(cat $TEMP_SCRIPT | sed 's/\"/\\\"/g' | tr '\n' ' ')\"" \
        --interactive 2>&1 || {
        echo "⚠️  Execute command failed, trying alternative method..."
        # Alternative: Run as a one-off task
        echo "Running as one-off task..."
        aws ecs run-task \
            --cluster "$CLUSTER_NAME" \
            --task-definition backend-task \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_ID],securityGroups=[$SECURITY_GROUP],assignPublicIp=DISABLED}" \
            --overrides "{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"python\",\"-c\",\"$(cat $TEMP_SCRIPT | sed 's/\"/\\\"/g' | tr '\n' ' ')\"]}]}" \
            --query "tasks[0].taskArn" --output text
    }
else
    echo "⚠️  Could not determine network configuration"
    echo "Please run the analysis manually:"
    echo ""
    echo "1. Get a shell on the backend container:"
    echo "   aws ecs execute-command --cluster $CLUSTER_NAME --task <TASK_ARN> --container backend --interactive"
    echo ""
    echo "2. Copy the script from: $TEMP_SCRIPT"
    echo "3. Run: python <script>"
fi

# Clean up
rm -f "$TEMP_SCRIPT"

echo ""
echo "✅ Analysis script prepared"
echo ""
echo "If execute-command didn't work, check CloudWatch logs for the output"
echo "or run the analysis manually using the steps above."

