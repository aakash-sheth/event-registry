#!/bin/bash

# Script to setup AWS EventBridge scheduler for daily digest emails
# Runs send_digests management command once per day at 8 AM UTC
# Usage: ./setup-digest-scheduler.sh

set -e

# Configuration - must match setup-analytics-scheduler.sh values
CLUSTER_NAME="event-registry-staging"
TASK_DEF="backend-task"
SUBNET_1="subnet-047b6a50234127a66"
SUBNET_2="subnet-043a1224e8eb0640d"
SG_ID="sg-02c8a03bf690d592f"
REGION="us-east-1"
ACCOUNT_ID="630147069059"

# Daily digest schedule: every day at 8:00 AM UTC
# Use cron(Minutes Hours Day-of-month Month Day-of-week Year)
SCHEDULE_EXPRESSION="cron(0 8 * * ? *)"

echo "Setting up AWS EventBridge scheduler for daily digest emails"
echo "============================================================="
echo ""
echo "Configuration:"
echo "  Cluster: $CLUSTER_NAME"
echo "  Task Definition: $TASK_DEF"
echo "  Schedule: Daily at 08:00 UTC"
echo "  Region: $REGION"
echo "  Account: $ACCOUNT_ID"
echo ""

# Step 1: Ensure IAM role exists (shared with analytics scheduler)
echo "Step 1: Checking IAM role for EventBridge..."
ROLE_NAME="EventBridge-ECSRunTask-Role"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    echo "   Role already exists: $ROLE_NAME"
else
    echo "   Creating IAM role: $ROLE_NAME"

    cat > /tmp/eventbridge-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "events.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/eventbridge-trust-policy.json \
        --description "Allows EventBridge to run ECS tasks"

    echo "   Role created"
    rm -f /tmp/eventbridge-trust-policy.json
fi

# Attach ECS RunTask policy
echo "   Attaching ECS RunTask policy..."
POLICY_NAME="EventBridge-ECSRunTask-Policy"

cat > /tmp/eventbridge-ecs-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecs:RunTask"
      ],
      "Resource": "arn:aws:ecs:$REGION:$ACCOUNT_ID:task-definition/$TASK_DEF"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole",
        "arn:aws:iam::$ACCOUNT_ID:role/backend-task-role"
      ]
    }
  ]
}
EOF

if aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" >/dev/null 2>&1; then
    echo "   Policy already attached"
else
    aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name "$POLICY_NAME" \
        --policy-document file:///tmp/eventbridge-ecs-policy.json

    echo "   Policy attached"
fi

ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
echo "   Role ARN: $ROLE_ARN"
rm -f /tmp/eventbridge-ecs-policy.json
echo ""

# Step 2: Create EventBridge rule
echo "Step 2: Creating EventBridge rule..."
RULE_NAME="daily-digest-sender"

if aws events describe-rule --name "$RULE_NAME" --region "$REGION" >/dev/null 2>&1; then
    echo "   Rule already exists: $RULE_NAME"
    read -p "   Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        UPDATE_RULE=true
    else
        UPDATE_RULE=false
        echo "   Skipping rule update"
    fi
else
    UPDATE_RULE=true
fi

if [ "$UPDATE_RULE" = true ]; then
    aws events put-rule \
        --name "$RULE_NAME" \
        --description "Triggers daily digest emails to hosts at 08:00 UTC" \
        --schedule-expression "$SCHEDULE_EXPRESSION" \
        --state ENABLED \
        --region "$REGION"

    echo "   Rule created/updated: $RULE_NAME"
fi

# Step 3: Create ECS target
echo "Step 3: Creating EventBridge target..."
TARGET_ID="digest-sender-ecs-task"

cat > /tmp/eventbridge-target.json <<EOF
{
  "Id": "$TARGET_ID",
  "Arn": "arn:aws:ecs:$REGION:$ACCOUNT_ID:cluster/$CLUSTER_NAME",
  "RoleArn": "$ROLE_ARN",
  "EcsParameters": {
    "TaskDefinitionArn": "arn:aws:ecs:$REGION:$ACCOUNT_ID:task-definition/$TASK_DEF",
    "LaunchType": "FARGATE",
    "NetworkConfiguration": {
      "awsvpcConfiguration": {
        "Subnets": ["$SUBNET_1", "$SUBNET_2"],
        "SecurityGroups": ["$SG_ID"],
        "AssignPublicIp": "DISABLED"
      }
    }
  },
  "Input": "{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"python\",\"manage.py\",\"send_digests\"]}]}"
}
EOF

# Remove existing target if present
aws events remove-targets \
    --rule "$RULE_NAME" \
    --ids "$TARGET_ID" \
    --region "$REGION" 2>/dev/null || true

# Add the target
aws events put-targets \
    --rule "$RULE_NAME" \
    --targets file:///tmp/eventbridge-target.json \
    --region "$REGION"

echo "   Target created: $TARGET_ID"
rm -f /tmp/eventbridge-target.json
echo ""

# Step 4: Verify
echo "Step 4: Verifying setup..."
RULE_STATUS=$(aws events describe-rule --name "$RULE_NAME" --region "$REGION" --query 'State' --output text)
TARGET_COUNT=$(aws events list-targets-by-rule --rule "$RULE_NAME" --region "$REGION" --query 'length(Targets)' --output text)

echo ""
echo "Setup Complete!"
echo "============================================================="
echo "Rule Name:  $RULE_NAME"
echo "Status:     $RULE_STATUS"
echo "Targets:    $TARGET_COUNT"
echo "Schedule:   Daily at 08:00 UTC"
echo ""
echo "Next Steps:"
echo "1. Digests will be sent automatically every day at 08:00 UTC"
echo "2. Monitor execution in CloudWatch Logs: /ecs/event-registry-staging/backend"
echo "3. View pending digest queue in Django admin: /api/admin/notifications/notificationqueue/"
echo ""
echo "To trigger a digest manually:"
echo "  aws ecs run-task \\"
echo "    --cluster $CLUSTER_NAME \\"
echo "    --task-definition $TASK_DEF \\"
echo "    --launch-type FARGATE \\"
echo "    --network-configuration \"awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SG_ID],assignPublicIp=DISABLED}\" \\"
echo "    --overrides '{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"python\",\"manage.py\",\"send_digests\"]}]}'"
echo ""
echo "To preview what would be sent without sending:"
echo "  aws ecs run-task ... --overrides '{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"python\",\"manage.py\",\"send_digests\",\"--dry-run\"]}]}'"
echo ""
echo "To disable the scheduler:"
echo "  aws events disable-rule --name $RULE_NAME --region $REGION"
echo ""
echo "To enable the scheduler:"
echo "  aws events enable-rule --name $RULE_NAME --region $REGION"
echo ""
echo "To delete the scheduler:"
echo "  aws events remove-targets --rule $RULE_NAME --ids $TARGET_ID --region $REGION"
echo "  aws events delete-rule --name $RULE_NAME --region $REGION"
echo ""
