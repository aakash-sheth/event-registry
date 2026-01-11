#!/bin/bash

# Diagnostic script to investigate why email wasn't sent
# This script only reads data, doesn't change anything

set -e

EMAIL="aakashsheth65@gmail.com"
CLUSTER_NAME="event-registry-staging"

echo "🔍 Investigating Email Issue for: $EMAIL"
echo "=========================================="
echo ""

# 1. Test the API endpoint and see what response we get
echo "1️⃣ Testing API endpoint..."
echo "   Calling: POST https://ekfern.com/api/auth/otp/start"
echo ""

API_RESPONSE=$(curl -s -X POST https://ekfern.com/api/auth/otp/start \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\"}")

echo "   Response:"
echo "$API_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$API_RESPONSE"
echo ""

# Check if OTP is in response (means email failed)
if echo "$API_RESPONSE" | grep -q "otp_code"; then
    echo "   ⚠️  OTP found in response - this means email sending FAILED"
    echo "      (OTP is only included when email fails or in DEBUG mode)"
    if echo "$API_RESPONSE" | grep -q "_dev_note"; then
        DEV_NOTE=$(echo "$API_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('_dev_note', ''))" 2>/dev/null || echo "")
        echo "      Note: $DEV_NOTE"
    fi
else
    echo "   ✅ No OTP in response - email was likely sent successfully"
fi

# Check if user doesn't exist error
if echo "$API_RESPONSE" | grep -q "No account found"; then
    echo ""
    echo "   ❌ USER DOES NOT EXIST"
    echo "      The email $EMAIL is not registered in the system"
    echo "      Solution: User needs to sign up first at /host/signup"
    exit 0
fi

echo ""
echo "2️⃣ Checking CloudWatch logs for email errors..."
echo "   (Last 50 lines from backend logs)"
echo ""

# Get recent logs
aws logs tail /ecs/$CLUSTER_NAME/backend --since 30m --format short 2>&1 | \
  grep -i "email\|ses\|otp\|Failed to send" | tail -20 || \
  echo "   No email-related errors found in recent logs"

echo ""
echo "3️⃣ Checking NotificationLog (email sending history)..."
echo "   This requires running a command in the ECS container"
echo ""

# Create a diagnostic command
cat > /tmp/check_email_logs.py << 'EOF'
import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'registry_backend.settings')
django.setup()

from apps.notifications.models import NotificationLog
from datetime import datetime, timedelta

email = 'aakashsheth65@gmail.com'
recent_time = datetime.now() - timedelta(hours=1)

print(f"\n📧 Email logs for: {email}")
print("=" * 50)

logs = NotificationLog.objects.filter(
    channel='email',
    to=email,
    created_at__gte=recent_time
).order_by('-created_at')[:10]

if logs.exists():
    for log in logs:
        status_icon = "✅" if log.status == 'sent' else "❌"
        print(f"\n{status_icon} Status: {log.status}")
        print(f"   Time: {log.created_at}")
        if log.status == 'failed' and log.last_error:
            print(f"   Error: {log.last_error}")
else:
    print("\n⚠️  No email logs found for this address in the last hour")
    print("   This could mean:")
    print("   1. User doesn't exist (check API response above)")
    print("   2. Email was never attempted")
    print("   3. Logs are older than 1 hour")

# Also check all recent email logs
print("\n\n📋 All recent email attempts (last 10):")
print("=" * 50)
all_logs = NotificationLog.objects.filter(
    channel='email'
).order_by('-created_at')[:10]

if all_logs.exists():
    for log in all_logs:
        status_icon = "✅" if log.status == 'sent' else "❌"
        print(f"{status_icon} {log.to} - {log.status} - {log.created_at}")
        if log.status == 'failed' and log.last_error:
            print(f"   Error: {log.last_error[:100]}")
else:
    print("No email logs found at all")
EOF

# Run the diagnostic in ECS
echo "   Running diagnostic command in ECS..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER_NAME" \
  --task-definition backend-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-047b6a50234127a66,subnet-043a1224e8eb0640d],securityGroups=[sg-02c8a03bf690d592f],assignPublicIp=DISABLED}" \
  --overrides '{
    "containerOverrides": [{
      "name": "backend",
      "command": ["python", "-c", "import sys; exec(open(\"/tmp/check_email_logs.py\").read())"]
    }]
  }' \
  --query 'tasks[0].taskArn' \
  --output text 2>/dev/null) || echo "   ⚠️  Could not run diagnostic command (may need to check logs manually)"

if [ -n "$TASK_ARN" ] && [ "$TASK_ARN" != "None" ]; then
    echo "   Task started: $TASK_ARN"
    echo "   Waiting for results..."
    sleep 10
    aws logs tail /ecs/$CLUSTER_NAME/backend --since 2m --format short 2>&1 | tail -30
fi

echo ""
echo "4️⃣ Checking SES Configuration..."
echo "   (Checking SSM parameters)"
echo ""

SES_REGION=$(aws ssm get-parameter --name "/event-registry-staging/SES_REGION" --query "Parameter.Value" --output text 2>/dev/null || echo "NOT SET")
SES_FROM_EMAIL=$(aws ssm get-parameter --name "/event-registry-staging/SES_FROM_EMAIL" --query "Parameter.Value" --output text 2>/dev/null || echo "NOT SET")

echo "   SES_REGION: $SES_REGION"
echo "   SES_FROM_EMAIL: $SES_FROM_EMAIL"

if [ "$SES_REGION" = "NOT SET" ] || [ "$SES_FROM_EMAIL" = "NOT SET" ]; then
    echo "   ⚠️  SES configuration may be missing!"
fi

echo ""
echo "=========================================="
echo "📝 Summary:"
echo ""
echo "Based on the investigation above:"
echo ""
echo "If API returned OTP in response:"
echo "  → Email sending failed (check NotificationLog errors above)"
echo ""
echo "If API returned 'No account found':"
echo "  → User doesn't exist, need to sign up first"
echo ""
echo "If API returned success without OTP:"
echo "  → Email was sent successfully (check spam folder)"
echo ""
echo "Next steps:"
echo "  1. Check the API response above"
echo "  2. Review NotificationLog errors"
echo "  3. Check CloudWatch logs for detailed errors"
echo "  4. Verify SES is out of sandbox mode"
echo "  5. Verify FROM email is verified in SES"


