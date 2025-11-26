# Quick Reference - Deployment Commands

Save these variables after Step 2 and reuse them:

```bash
# Set these after Step 2 (VPC Setup)
export VPC_ID="vpc-xxxxx"
export PUBLIC_SUBNET_1="subnet-xxxxx"
export PUBLIC_SUBNET_2="subnet-xxxxx"
export PRIVATE_SUBNET_1="subnet-xxxxx"
export PRIVATE_SUBNET_2="subnet-xxxxx"
export ALB_SG="sg-xxxxx"
export BACKEND_SG="sg-xxxxx"
export FRONTEND_SG="sg-xxxxx"
export RDS_SG="sg-xxxxx"
export VPC_ENDPOINT_SG="sg-xxxxx"
export PUBLIC_RT="rtb-xxxxx"
export PRIVATE_RT="rtb-xxxxx"

# Set these after Step 4 (RDS)
export RDS_ENDPOINT="xxxxx.xxxxx.us-east-1.rds.amazonaws.com"
export DB_PASSWORD="your-password"
export DATABASE_URL="postgres://postgres:$DB_PASSWORD@$RDS_ENDPOINT:5432/registry"

# Set these after Step 5 (ECR)
export BACKEND_ECR_URI="xxxxx.dkr.ecr.us-east-1.amazonaws.com/wedding-registry-backend-staging"
export FRONTEND_ECR_URI="xxxxx.dkr.ecr.us-east-1.amazonaws.com/wedding-registry-frontend-staging"

# Set these after Step 6 (S3)
export BUCKET_NAME="wedding-registry-staging-uploads-xxxxx"

# Set these after Step 12 (ALB)
export ALB_DNS="staging-alb-xxxxx.us-east-1.elb.amazonaws.com"

# Set these for convenience
export ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export REGION=$(aws configure get region)
```

## Common Commands

### Check Service Status
```bash
aws ecs describe-services --cluster wedding-registry-staging --services backend-service frontend-service
```

### View Logs
```bash
# Backend logs
aws logs tail /ecs/wedding-registry-staging/backend --follow

# Frontend logs
aws logs tail /ecs/wedding-registry-staging/frontend --follow
```

### Scale Services
```bash
# Scale to 0 (cost savings)
aws ecs update-service --cluster wedding-registry-staging --service backend-service --desired-count 0
aws ecs update-service --cluster wedding-registry-staging --service frontend-service --desired-count 0

# Scale to 1
aws ecs update-service --cluster wedding-registry-staging --service backend-service --desired-count 1
aws ecs update-service --cluster wedding-registry-staging --service frontend-service --desired-count 1
```

### Force New Deployment
```bash
aws ecs update-service --cluster wedding-registry-staging --service backend-service --force-new-deployment
aws ecs update-service --cluster wedding-registry-staging --service frontend-service --force-new-deployment
```

### Update SSM Parameter
```bash
aws ssm put-parameter --name "/registry-staging/PARAMETER_NAME" --type "String" --value "new-value" --overwrite
```

### Check Target Health
```bash
aws elbv2 describe-target-health --target-group-arn <target-group-arn>
```

### Run Migrations
```bash
aws ecs run-task \
  --cluster wedding-registry-staging \
  --task-definition backend-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1],securityGroups=[$BACKEND_SG],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["python","manage.py","migrate"]}]}'
```

