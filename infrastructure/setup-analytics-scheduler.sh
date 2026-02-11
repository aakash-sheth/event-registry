#!/bin/bash

# Script to setup AWS EventBridge scheduler for analytics batch processing
# This is the most reliable approach - uses AWS managed service with 99.99% uptime SLA
# Usage: ./setup-analytics-scheduler.sh

set -e

# Configuration - Update these values if needed
CLUSTER_NAME="event-registry-staging"
TASK_DEF="backend-task"
SUBNET_1="subnet-047b6a50234127a66"
SUBNET_2="subnet-043a1224e8eb0640d"
SG_ID="sg-02c8a03bf690d592f"
REGION="us-east-1"
ACCOUNT_ID="630147069059"

# Batch processing interval (in minutes) - can be overridden by environment variable
BATCH_INTERVAL_MINUTES="${ANALYTICS_BATCH_INTERVAL_MINUTES:-30}"

echo "🚀 Setting up AWS EventBridge scheduler for analytics batch processing"
echo "======================================================================"
echo ""
echo "Configuration:"
echo "  Cluster: $CLUSTER_NAME"
echo "  Task Definition: $TASK_DEF"
echo "  Interval: Every $BATCH_INTERVAL_MINUTES minutes"
echo "  Region: $REGION"
echo "  Account: $ACCOUNT_ID"
echo ""

# Step 1: Create IAM role for EventBridge to run ECS tasks
echo "📋 Step 1: Creating IAM role for EventBridge..."
ROLE_NAME="EventBridge-ECSRunTask-Role"

# Check if role exists
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
    echo "   ✅ Role already exists: $ROLE_NAME"
else
    echo "   Creating IAM role: $ROLE_NAME"
    
    # Create trust policy for EventBridge
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

    # Create the role
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document file:///tmp/eventbridge-trust-policy.json \
        --description "Allows EventBridge to run ECS tasks for analytics batch processing"
    
    echo "   ✅ Role created"
    rm -f /tmp/eventbridge-trust-policy.json
fi

# Attach policy to allow ECS RunTask
echo "   Attaching ECS RunTask policy..."
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

# Check if policy exists
POLICY_NAME="EventBridge-ECSRunTask-Policy"
if aws iam get-role-policy --role-name "$ROLE_NAME" --policy-name "$POLICY_NAME" >/dev/null 2>&1; then
    echo "   ✅ Policy already attached"
else
    aws iam put-role-policy \
        --role-name "$ROLE_NAME" \
        --policy-name "$POLICY_NAME" \
        --policy-document file:///tmp/eventbridge-ecs-policy.json
    
    echo "   ✅ Policy attached"
fi

ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
echo "   Role ARN: $ROLE_ARN"
rm -f /tmp/eventbridge-ecs-policy.json
echo ""

# Step 2: Create EventBridge rule
echo "📋 Step 2: Creating EventBridge rule..."
RULE_NAME="analytics-batch-processor"

# Use rate expression for flexibility
RATE_EXPRESSION="rate($BATCH_INTERVAL_MINUTES minutes)"

# Check if rule exists
if aws events describe-rule --name "$RULE_NAME" --region "$REGION" >/dev/null 2>&1; then
    echo "   ⚠️  Rule already exists: $RULE_NAME"
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
    # Create/update the rule
    aws events put-rule \
        --name "$RULE_NAME" \
        --description "Triggers analytics batch processing every $BATCH_INTERVAL_MINUTES minutes" \
        --schedule-expression "$RATE_EXPRESSION" \
        --state ENABLED \
        --region "$REGION"
    
    echo "   ✅ Rule created/updated: $RULE_NAME"
fi

# Step 3: Create target (ECS task)
echo "📋 Step 3: Creating EventBridge target..."
TARGET_ID="analytics-batch-ecs-task"

# Build the target JSON
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
  "Input": "{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"python\",\"manage.py\",\"process_analytics_batch\"]}]}"
}
EOF

# Remove existing target if it exists
aws events remove-targets \
    --rule "$RULE_NAME" \
    --ids "$TARGET_ID" \
    --region "$REGION" 2>/dev/null || true

# Add the target
aws events put-targets \
    --rule "$RULE_NAME" \
    --targets file:///tmp/eventbridge-target.json \
    --region "$REGION"

echo "   ✅ Target created: $TARGET_ID"
rm -f /tmp/eventbridge-target.json
echo ""

# Step 4: Verify setup
echo "📋 Step 4: Verifying setup..."
RULE_STATUS=$(aws events describe-rule --name "$RULE_NAME" --region "$REGION" --query 'State' --output text)
TARGET_COUNT=$(aws events list-targets-by-rule --rule "$RULE_NAME" --region "$REGION" --query 'length(Targets)' --output text)

echo ""
echo "✅ Setup Complete!"
echo "======================================================================"
echo "Rule Name: $RULE_NAME"
echo "Status: $RULE_STATUS"
echo "Targets: $TARGET_COUNT"
echo "Schedule: Every $BATCH_INTERVAL_MINUTES minutes"
echo ""
echo "Next Steps:"
echo "1. The scheduler will automatically trigger every $BATCH_INTERVAL_MINUTES minutes"
echo "2. Monitor execution in CloudWatch Logs: /ecs/$CLUSTER_NAME/backend"
echo "3. View scheduled runs in Django admin: /api/admin/analytics-batch/"
echo ""
echo "To test manually:"
echo "  aws ecs run-task \\"
echo "    --cluster $CLUSTER_NAME \\"
echo "    --task-definition $TASK_DEF \\"
echo "    --launch-type FARGATE \\"
echo "    --network-configuration \"awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SG_ID],assignPublicIp=DISABLED}\" \\"
echo "    --overrides '{\"containerOverrides\":[{\"name\":\"backend\",\"command\":[\"python\",\"manage.py\",\"process_analytics_batch\"]}]}'"
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
