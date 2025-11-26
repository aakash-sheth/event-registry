# AWS Staging Deployment Guide

This guide walks through deploying the event registry application to AWS staging environment.

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI installed and configured
3. Docker installed locally (for testing)
4. GitHub repository with secrets configured

## Phase 0: Code Preparation ✅

All code changes have been completed:
- ✅ Production Dockerfiles created
- ✅ Gunicorn added to requirements
- ✅ Entrypoint script updated
- ✅ Health check endpoint added
- ✅ Security settings configured

## Phase 1: AWS Infrastructure Setup

### Step 1: Create VPC and Networking

1. Create VPC:
   ```bash
   aws ec2 create-vpc --cidr-block 10.0.0.0/16 --region us-east-1
   ```

2. Create subnets (2 public, 2 private across 2 AZs)

3. Create Internet Gateway and attach to VPC

4. Configure route tables

5. Create security groups:
   - ALB security group (allow 80, 443 from 0.0.0.0/0)
   - Backend ECS security group (allow 8000 from ALB)
   - Frontend ECS security group (allow 3000 from ALB)
   - RDS security group (allow 5432 from backend ECS)
   - VPC Endpoint security group

### Step 2: Create VPC Endpoints

```bash
# S3 Gateway Endpoint (free)
aws ec2 create-vpc-endpoint \
  --vpc-id <vpc-id> \
  --service-name com.amazonaws.us-east-1.s3 \
  --route-table-ids <private-route-table-id>

# ECR Interface Endpoint
aws ec2 create-vpc-endpoint \
  --vpc-id <vpc-id> \
  --service-name com.amazonaws.us-east-1.ecr.dkr \
  --subnet-ids <private-subnet-1> <private-subnet-2> \
  --security-group-ids <vpc-endpoint-sg> \
  --vpc-endpoint-type Interface

# SES Interface Endpoint
aws ec2 create-vpc-endpoint \
  --vpc-id <vpc-id> \
  --service-name com.amazonaws.us-east-1.email \
  --subnet-ids <private-subnet-1> <private-subnet-2> \
  --security-group-ids <vpc-endpoint-sg> \
  --vpc-endpoint-type Interface
```

### Step 3: Create RDS Database

```bash
aws rds create-db-instance \
  --db-instance-identifier event-registry-staging \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 15 \
  --master-username postgres \
  --master-user-password <secure-password> \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids <rds-sg> \
  --db-subnet-group-name <db-subnet-group> \
  --backup-retention-period 7 \
  --no-multi-az \
  --region us-east-1
```

### Step 4: Create ECR Repositories

```bash
aws ecr create-repository \
  --repository-name event-registry-backend-staging \
  --region us-east-1

aws ecr create-repository \
  --repository-name event-registry-frontend-staging \
  --region us-east-1
```

### Step 5: Create S3 Bucket

```bash
aws s3 mb s3://event-registry-staging-uploads --region us-east-1

# Configure CORS
aws s3api put-bucket-cors \
  --bucket event-registry-staging-uploads \
  --cors-configuration file://infrastructure/s3-cors.json

# Configure lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket event-registry-staging-uploads \
  --lifecycle-configuration file://infrastructure/s3-lifecycle.json
```

### Step 6: Set Up SSM Parameters

Run the setup script:
```bash
cd infrastructure
./setup-ssm-parameters.sh
```

Or manually create parameters using AWS Console or CLI.

### Step 7: Create IAM Roles

1. **ECS Task Execution Role**: For pulling images from ECR and writing logs
2. **Backend Task Role**: For accessing S3, SES, and SSM
3. **Frontend Task Role**: For accessing SSM

### Step 8: Create CloudWatch Log Groups

```bash
aws logs create-log-group \
  --log-group-name /ecs/event-registry-staging/backend \
  --region us-east-1

aws logs create-log-group \
  --log-group-name /ecs/event-registry-staging/frontend \
  --region us-east-1

# Set retention to 14 days
aws logs put-retention-policy \
  --log-group-name /ecs/event-registry-staging/backend \
  --retention-in-days 14

aws logs put-retention-policy \
  --log-group-name /ecs/event-registry-staging/frontend \
  --retention-in-days 14
```

### Step 9: Create ECS Task Definitions

1. Update task definition JSON files with your account ID and region
2. Register task definitions:

```bash
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/ecs-task-definitions/backend-task-definition.json

aws ecs register-task-definition \
  --cli-input-json file://infrastructure/ecs-task-definitions/frontend-task-definition.json
```

### Step 10: Create ECS Cluster and Services

```bash
# Create cluster
aws ecs create-cluster --cluster-name event-registry-staging

# Create backend service
aws ecs create-service \
  --cluster event-registry-staging \
  --service-name backend-service \
  --task-definition backend-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}"

# Create frontend service
aws ecs create-service \
  --cluster event-registry-staging \
  --service-name frontend-service \
  --task-definition frontend-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-xxx],assignPublicIp=DISABLED}"
```

### Step 11: Create Application Load Balancer

1. Create ALB in public subnets
2. Create target groups (backend: port 8000, frontend: port 3000)
3. Configure listener rules:
   - `/api/*` → backend target group
   - `/*` → frontend target group
4. Configure HTTPS listener (port 443)
5. Set up HTTP to HTTPS redirect

### Step 12: Run Initial Migrations

```bash
aws ecs run-task \
  --cluster event-registry-staging \
  --task-definition backend-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["python","manage.py","migrate"]}]}'
```

## Phase 2: CI/CD Setup

### Configure GitHub Secrets

Add these secrets to your GitHub repository:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (optional, defaults to us-east-1)

The workflow file (`.github/workflows/deploy-staging.yml`) is already created and will:
1. Build Docker images
2. Push to ECR
3. Update ECS services
4. Run migrations
5. Verify health checks

## Phase 3: Post-Deployment

1. Test the application via ALB URL
2. Verify health checks are passing
3. Test image uploads (S3 via VPC Endpoint)
4. Test email sending (SES via VPC Endpoint)
5. Monitor CloudWatch logs
6. Set up CloudWatch alarms

## Cost Optimization

- Scale services to 0 when not testing:
  ```bash
  aws ecs update-service --cluster event-registry-staging --service backend-service --desired-count 0
  aws ecs update-service --cluster event-registry-staging --service frontend-service --desired-count 0
  ```

- Scale back up when needed:
  ```bash
  aws ecs update-service --cluster event-registry-staging --service backend-service --desired-count 1
  aws ecs update-service --cluster event-registry-staging --service frontend-service --desired-count 1
  ```

## Troubleshooting

- Check ECS service events for deployment issues
- Review CloudWatch logs for application errors
- Verify security group rules allow traffic
- Ensure VPC Endpoints are configured correctly
- Check SSM parameters are accessible by task roles

## Next Steps

When adding Razorpay payments:
1. Create NAT Gateway in public subnet
2. Update route tables for private subnets
3. Add Razorpay parameters to SSM
4. Update webhook URL in Razorpay dashboard

