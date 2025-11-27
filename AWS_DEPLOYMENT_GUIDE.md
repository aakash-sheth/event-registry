# AWS Staging Deployment - Step-by-Step Guide

This guide will walk you through deploying your event registry application to AWS staging environment.

## Prerequisites

Before starting, ensure you have:
- [ ] AWS account with admin access (or appropriate permissions)
- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Docker installed locally (for testing)
- [ ] GitHub repository access
- [ ] Basic understanding of AWS services

## Step 1: Configure AWS CLI

```bash
# Install AWS CLI if not already installed
# macOS: brew install awscli
# Linux: sudo apt-get install awscli
# Windows: Download from AWS website

# Configure AWS credentials
aws configure
# Enter:
# - AWS Access Key ID: [your access key]
# - AWS Secret Access Key: [your secret key]
# - Default region: us-east-1 (or your preferred region)
# - Default output format: json

# Verify configuration
aws sts get-caller-identity
```

## Step 2: Create VPC and Networking

### 2.1 Create VPC

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=event-registry-staging}]' \
  --query 'Vpc.VpcId' \
  --output text)

echo "VPC ID: $VPC_ID"
# Save this VPC_ID - you'll need it for subsequent steps
```
vpc-0150736050b2f8bc7

### 2.2 Create Subnets

```bash
# Get availability zones
AZ1=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[0].ZoneName' --output text)
AZ2=$(aws ec2 describe-availability-zones --query 'AvailabilityZones[1].ZoneName' --output text)

# Create public subnet 1 (for ALB)
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.1.0/24 \
  --availability-zone $AZ1 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=staging-public-1}]' \
  --query 'Subnet.SubnetId' \
  --output text)

# Create public subnet 2 (for ALB)
PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.2.0/24 \
  --availability-zone $AZ2 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=staging-public-2}]' \
  --query 'Subnet.SubnetId' \
  --output text)

# Create private subnet 1 (for ECS + RDS)
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.3.0/24 \
  --availability-zone $AZ1 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=staging-private-1}]' \
  --query 'Subnet.SubnetId' \
  --output text)

# Create private subnet 2 (for ECS + RDS)
PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID \
  --cidr-block 10.0.4.0/24 \
  --availability-zone $AZ2 \
  --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=staging-private-2}]' \
  --query 'Subnet.SubnetId' \
  --output text)

echo "Public Subnets: $PUBLIC_SUBNET_1, $PUBLIC_SUBNET_2"
echo "Private Subnets: $PRIVATE_SUBNET_1, $PRIVATE_SUBNET_2"
# Save these subnet IDs
```
Public Subnets: , subnet-0781ee8d36f10d08e
Private Subnets: subnet-047b6a50234127a66, subnet-043a1224e8eb0640d

### 2.3 Create Internet Gateway

```bash
# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=staging-igw}]' \
  --query 'InternetGateway.InternetGatewayId' \
  --output text)

# Attach to VPC
aws ec2 attach-internet-gateway \
  --internet-gateway-id $IGW_ID \
  --vpc-id $VPC_ID

echo "Internet Gateway ID: $IGW_ID"
```
Internet Gateway ID: igw-0f357a95fb04ccd4c

### 2.4 Create Route Tables

```bash
# Create public route table
PUBLIC_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=staging-public-rt}]' \
  --query 'RouteTable.RouteTableId' \
  --output text)

# Add route to internet gateway
aws ec2 create-route \
  --route-table-id $PUBLIC_RT \
  --destination-cidr-block 0.0.0.0/0 \
  --gateway-id $IGW_ID

# subnet-00903760b47ea9f39
# PUBLIC_SUBNET_1: subnet-00903760b47ea9f39
# Associate public subnets with public route table
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_1 --route-table-id $PUBLIC_RT
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_2 --route-table-id $PUBLIC_RT

# PUBLIC_SUBNET_1: subnet-00903760b47ea9f39
# PUBLIC_SUBNET_2: subnet-0781ee8d36f10d08e
# PRIVATE_SUBNET_1: subnet-047b6a50234127a66
# PRIVATE_SUBNET_2: subnet-043a1224e8eb0640d
# Create private route table (no internet route - uses VPC endpoints)
PRIVATE_RT=$(aws ec2 create-route-table \
  --vpc-id $VPC_ID \
  --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=staging-private-rt}]' \
  --query 'RouteTable.RouteTableId' \
  --output text)

# Associate private subnets with private route table
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_1 --route-table-id $PRIVATE_RT
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_2 --route-table-id $PRIVATE_RT

echo "Route Tables: Public=$PUBLIC_RT, Private=$PRIVATE_RT"
```
<!-- Route Tables: Public=rtb-0ac008aef20b71775, Private=rtb-0f4d2c9b994b1e666 -->

### 2.5 Create Security Groups

```bash
# ALB Security Group
ALB_SG=$(aws ec2 create-security-group \
  --group-name staging-alb-sg \
  --description "Security group for ALB" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow HTTP and HTTPS from internet
aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id $ALB_SG \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

# Backend ECS Security Group
BACKEND_SG=$(aws ec2 create-security-group \
  --group-name staging-backend-sg \
  --description "Security group for backend ECS tasks" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow port 8000 from ALB
aws ec2 authorize-security-group-ingress \
  --group-id $BACKEND_SG \
  --protocol tcp \
  --port 8000 \
  --source-group $ALB_SG

# Frontend ECS Security Group
FRONTEND_SG=$(aws ec2 create-security-group \
  --group-name staging-frontend-sg \
  --description "Security group for frontend ECS tasks" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow port 3000 from ALB
aws ec2 authorize-security-group-ingress \
  --group-id $FRONTEND_SG \
  --protocol tcp \
  --port 3000 \
  --source-group $ALB_SG

# RDS Security Group
RDS_SG=$(aws ec2 create-security-group \
  --group-name staging-rds-sg \
  --description "Security group for RDS" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow PostgreSQL from backend ECS
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 5432 \
  --source-group $BACKEND_SG

# VPC Endpoint Security Group
VPC_ENDPOINT_SG=$(aws ec2 create-security-group \
  --group-name staging-vpc-endpoint-sg \
  --description "Security group for VPC endpoints" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

# Allow HTTPS from ECS tasks
aws ec2 authorize-security-group-ingress \
  --group-id $VPC_ENDPOINT_SG \
  --protocol tcp \
  --port 443 \
  --source-group $BACKEND_SG

aws ec2 authorize-security-group-ingress \
  --group-id $VPC_ENDPOINT_SG \
  --protocol tcp \
  --port 443 \
  --source-group $FRONTEND_SG

echo "Security Groups:"
echo "  ALB: $ALB_SG"
echo "  Backend: $BACKEND_SG"
echo "  Frontend: $FRONTEND_SG"
echo "  RDS: $RDS_SG"
echo "  VPC Endpoint: $VPC_ENDPOINT_SG"
# Save all these security group IDs
```
<!-- Security Groups:
  ALB: sg-053cea6211c9e7db5
  Backend: sg-02c8a03bf690d592f
  Frontend: sg-0616bc6241976f231
  RDS: sg-0de0023b26d1237de
  VPC Endpoint: sg-040027b98e02a3973 -->

## Step 3: Create VPC Endpoints

### 3.1 S3 Gateway Endpoint (Free)

```bash
# Create S3 Gateway Endpoint
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-1.s3 \
  --route-table-ids $PRIVATE_RT \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=staging-s3-endpoint}]'

echo "S3 Gateway Endpoint created (free)"
```

### 3.2 ECR Interface Endpoint

```bash
# Create ECR DKR endpoint (for pulling images)
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-1.ecr.dkr \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $VPC_ENDPOINT_SG \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=staging-ecr-dkr-endpoint}]'

# Create ECR API endpoint
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-1.ecr.api \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $VPC_ENDPOINT_SG \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=staging-ecr-api-endpoint}]'

echo "ECR Interface Endpoints created"
```

### 3.3 SES Interface Endpoint

```bash
# Create SES endpoint
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-1.email \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $VPC_ENDPOINT_SG \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=staging-ses-endpoint}]'

echo "SES Interface Endpoint created"
```

### 3.4 SSM Interface Endpoint (Optional but Recommended)

```bash
# Create SSM endpoint
aws ec2 create-vpc-endpoint \
  --vpc-id $VPC_ID \
  --service-name com.amazonaws.us-east-1.ssm \
  --vpc-endpoint-type Interface \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --security-group-ids $VPC_ENDPOINT_SG \
  --tag-specifications 'ResourceType=vpc-endpoint,Tags=[{Key=Name,Value=staging-ssm-endpoint}]'

echo "SSM Interface Endpoint created"
```

## Step 4: Create RDS Database

### 4.1 Create DB Subnet Group

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name staging-db-subnet-group \
  --db-subnet-group-description "Subnet group for staging RDS" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2 \
  --tags Key=Name,Value=staging-db-subnet-group

echo "DB Subnet Group created"
```

### 4.2 Create RDS Instance

```bash
# Generate a secure password (or set your own)
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
echo "Database Password: $DB_PASSWORD"
# SAVE THIS PASSWORD - you'll need it for DATABASE_URL

# Database Password: eF0gyLk2k3MjUxhg1qPbGxVIz
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier event-registry-staging \
  --db-instance-class db.t4g.micro \
  --engine postgres \
  --engine-version 15.15 \
  --master-username postgres \
  --master-user-password $DB_PASSWORD \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name staging-db-subnet-group \
  --backup-retention-period 7 \
  --no-multi-az \
  --no-publicly-accessible \
  --tags Key=Name,Value=staging-db

echo "RDS instance creation started. This will take 5-10 minutes."
echo "Monitor with: aws rds describe-db-instances --db-instance-identifier event-registry-staging"

# Wait for RDS to be available
echo "Waiting for RDS to be available..."
aws rds wait db-instance-available --db-instance-identifier event-registry-staging

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier event-registry-staging \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
echo "DATABASE_URL will be: postgres://postgres:$DB_PASSWORD@$RDS_ENDPOINT:5432/registry"
# Save this DATABASE_URL for Step 7
```
<!-- RDS Endpoint: event-registry-staging.c0fai6w4ivpm.us-east-1.rds.amazonaws.com
DATABASE_URL will be: postgres://postgres:eF0gyLk2k3MjUxhg1qPbGxVIz@event-registry-staging.c0fai6w4ivpm.us-east-1.rds.amazonaws.com:5432/registry -->

## Step 5: Create ECR Repositories

```bash
# Create backend repository
aws ecr create-repository \
  --repository-name event-registry-backend-staging \
  --image-scanning-configuration scanOnPush=true \
  --tags Key=Name,Value=staging-backend-ecr

# Create frontend repository
aws ecr create-repository \
  --repository-name event-registry-frontend-staging \
  --image-scanning-configuration scanOnPush=true \
  --tags Key=Name,Value=staging-frontend-ecr

# Get repository URIs
BACKEND_ECR_URI=$(aws ecr describe-repositories \
  --repository-names event-registry-backend-staging \
  --query 'repositories[0].repositoryUri' \
  --output text)

FRONTEND_ECR_URI=$(aws ecr describe-repositories \
  --repository-names event-registry-frontend-staging \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo "Backend ECR URI: $BACKEND_ECR_URI"
echo "Frontend ECR URI: $FRONTEND_ECR_URI"
# Save these URIs
```
<!-- 
echo "Frontend ECR URI: $FRONTEND_ECR_URI"
Backend ECR URI: 630147069059.dkr.ecr.us-east-1.amazonaws.com/event-registry-backend-staging
Frontend ECR URI: 630147069059.dkr.ecr.us-east-1.amazonaws.com/event-registry-frontend-staging -->

## Step 6: Create S3 Bucket

```bash
# Set bucket name (must be globally unique)
BUCKET_NAME="event-registry-staging-uploads-$(date +%s)"

# Create bucket
aws s3 mb s3://$BUCKET_NAME --region us-east-1

# Apply CORS configuration
aws s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration file://infrastructure/s3-cors.json

# Apply lifecycle policy (skipped for now)
aws s3api put-bucket-lifecycle-configuration \
  --bucket $BUCKET_NAME \
  --lifecycle-configuration file://infrastructure/s3-lifecycle.json

# Set bucket policy for public-read objects (if needed)
# Note: You may want to restrict this further in production
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket $BUCKET_NAME \
  --policy file:///tmp/bucket-policy.json

echo "S3 Bucket: $BUCKET_NAME"
# Save this bucket name
```
<!-- S3 Bucket: event-registry-staging-uploads-1764200910 -->
## Step 7: Set Up SSM Parameters

```bash
# Get your AWS account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

echo "Account ID: $ACCOUNT_ID"
echo "Region: $REGION"

# Run the interactive SSM parameter setup script
cd infrastructure
chmod +x setup-ssm-parameters.sh
./setup-ssm-parameters.sh

# When prompted, enter:
# - DJANGO_SECRET_KEY: Generate with: python -c "import secrets; print(secrets.token_urlsafe(50))"
# - DATABASE_URL: postgres://postgres:$DB_PASSWORD@$RDS_ENDPOINT:5432/registry
# - AWS_S3_BUCKET: $BUCKET_NAME
# - AWS_S3_REGION: us-east-1 (or your region)
# - ALB DNS: (you'll get this after creating ALB in Step 10)
# - Email provider: ses or sendgrid
# - Other values as needed

cd ..
```

**Note:** For ALB DNS, you can skip it now and update it later after creating the ALB.

## Step 8: Create IAM Roles

### 8.1 Create ECS Task Execution Role

```bash
# Create trust policy
cat > /tmp/ecs-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file:///tmp/ecs-trust-policy.json

# Attach managed policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

echo "ECS Task Execution Role created"
```

### 8.2 Create Backend Task Role

```bash
# Create backend task role
aws iam create-role \
  --role-name backend-task-role \
  --assume-role-policy-document file:///tmp/ecs-trust-policy.json

# Create and attach backend policy
aws iam put-role-policy \
  --role-name backend-task-role \
  --policy-name backend-task-policy \
  --policy-document file://infrastructure/iam-policies/backend-task-role-policy.json

# Update S3 bucket name in policy if different
# Edit infrastructure/iam-policies/backend-task-role-policy.json first if needed

echo "Backend Task Role created"
```

### 8.3 Create Frontend Task Role

```bash
# Create frontend task role
aws iam create-role \
  --role-name frontend-task-role \
  --assume-role-policy-document file:///tmp/ecs-trust-policy.json

# Create and attach frontend policy
aws iam put-role-policy \
  --role-name frontend-task-role \
  --policy-name frontend-task-policy \
  --policy-document file://infrastructure/iam-policies/frontend-task-role-policy.json

echo "Frontend Task Role created"
```

## Step 9: Create CloudWatch Log Groups

```bash
# Create backend log group
aws logs create-log-group \
  --log-group-name /ecs/event-registry-staging/backend

# Set retention to 14 days
aws logs put-retention-policy \
  --log-group-name /ecs/event-registry-staging/backend \
  --retention-in-days 14

# Create frontend log group
aws logs create-log-group \
  --log-group-name /ecs/event-registry-staging/frontend

# Set retention to 14 days
aws logs put-retention-policy \
  --log-group-name /ecs/event-registry-staging/frontend \
  --retention-in-days 14

echo "CloudWatch Log Groups created"
```

## Step 10: Update and Register ECS Task Definitions

### 10.1 Update Task Definition Files

```bash
# Get your account ID and region
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region)

# Update backend task definition
sed -i.bak "s/ACCOUNT_ID/$ACCOUNT_ID/g" infrastructure/ecs-task-definitions/backend-task-definition.json
sed -i.bak "s/REGION/$REGION/g" infrastructure/ecs-task-definitions/backend-task-definition.json

# Update frontend task definition
sed -i.bak "s/ACCOUNT_ID/$ACCOUNT_ID/g" infrastructure/ecs-task-definitions/frontend-task-definition.json
sed -i.bak "s/REGION/$REGION/g" infrastructure/ecs-task-definitions/frontend-task-definition.json

echo "Task definitions updated with Account ID and Region"
```

### 10.2 Register Task Definitions

```bash
# Register backend task definition
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/ecs-task-definitions/backend-task-definition.json

# Register frontend task definition
aws ecs register-task-definition \
  --cli-input-json file://infrastructure/ecs-task-definitions/frontend-task-definition.json

echo "Task definitions registered"
```

## Step 11: Create ECS Cluster and Services

### 11.1 Create ECS Cluster

```bash
# Create cluster
aws ecs create-cluster \
  --cluster-name event-registry-staging \
  --tags key=Name,value=staging-cluster

echo "ECS Cluster created"
```

### 11.2 Create Backend Service

```bash
# Create backend service
aws ecs create-service \
  --cluster event-registry-staging \
  --service-name backend-service \
  --task-definition backend-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$BACKEND_SG],assignPublicIp=DISABLED}"

echo "Backend service created"
```

### 11.3 Create Frontend Service

```bash
# Create frontend service
aws ecs create-service \
  --cluster event-registry-staging \
  --service-name frontend-service \
  --task-definition frontend-task \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$FRONTEND_SG],assignPublicIp=DISABLED}"

echo "Frontend service created"
```

## Step 12: Create Application Load Balancer

### 12.1 Create ALB

```bash
# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name staging-alb \
  --subnets $PUBLIC_SUBNET_1 $PUBLIC_SUBNET_2 \
  --security-groups $ALB_SG \
  --tags Key=Name,Value=staging-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

echo "ALB ARN: $ALB_ARN"
# ALB ARN: arn:aws:elasticloadbalancing:us-east-1:630147069059:loadbalancer/app/staging-alb/ff8510f9e670183b
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "ALB DNS: $ALB_DNS"
# Save this DNS name - you'll need it for SSM parameters
```
<!-- ALB DNS: staging-alb-33342285.us-east-1.elb.amazonaws.com -->

### 12.2 Create Target Groups

```bash
# Create backend target group
BACKEND_TG_ARN=$(aws elbv2 create-target-group \
  --name staging-backend-tg \
  --protocol HTTP \
  --port 8000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Create frontend target group
FRONTEND_TG_ARN=$(aws elbv2 create-target-group \
  --name staging-frontend-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path / \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

echo "Target Groups created"
```

### 12.3 Create Listeners

```bash
# Create HTTPS listener (port 443)
# Note: You'll need an ACM certificate. For now, we'll use HTTP.
# You can add HTTPS later with: aws acm request-certificate

# Create HTTP listener (port 80) with rules
LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN \
  --query 'Listeners[0].ListenerArn' \
  --output text)

# Add rule for /api/* to backend
aws elbv2 create-rule \
  --listener-arn $LISTENER_ARN \
  --priority 100 \
  --conditions Field=path-pattern,Values='/api/*' \
  --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN

echo "ALB Listeners and Rules created"
```

### 12.4 Attach Services to Target Groups

```bash
# Get service task ARNs (wait a bit for tasks to start)
sleep 30

# Get backend task IPs
BACKEND_TASK_IPS=$(aws ecs list-tasks \
  --cluster event-registry-staging \
  --service-name backend-service \
  --query 'taskArns[]' \
  --output text | head -1 | xargs -I {} aws ecs describe-tasks \
    --cluster event-registry-staging \
    --tasks {} \
    --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' \
    --output text)

# Get frontend task IPs
FRONTEND_TASK_IPS=$(aws ecs list-tasks \
  --cluster event-registry-staging \
  --service-name frontend-service \
  --query 'taskArns[]' \
  --output text | head -1 | xargs -I {} aws ecs describe-tasks \
    --cluster event-registry-staging \
    --tasks {} \
    --query 'tasks[0].attachments[0].details[?name==`privateIPv4Address`].value' \
    --output text)

# Register backend targets
if [ -n "$BACKEND_TASK_IPS" ]; then
  aws elbv2 register-targets \
    --target-group-arn $BACKEND_TG_ARN \
    --targets Id=$BACKEND_TASK_IPS
fi

# Register frontend targets
if [ -n "$FRONTEND_TASK_IPS" ]; then
  aws elbv2 register-targets \
    --target-group-arn $FRONTEND_TG_ARN \
    --targets Id=$FRONTEND_TASK_IPS
fi

echo "Targets registered (ECS will auto-register new tasks)"
```

## Step 13: Update SSM Parameters with ALB DNS

```bash
# Update ALB_DNS in SSM
aws ssm put-parameter \
  --name "/event-registry-staging/ALB_DNS" \
  --type "String" \
  --value "$ALB_DNS" \
  --overwrite

# Update NEXT_PUBLIC_API_BASE
aws ssm put-parameter \
  --name "/event-registry-staging/NEXT_PUBLIC_API_BASE" \
  --type "String" \
  --value "http://$ALB_DNS" \
  --overwrite

# Update ALLOWED_HOSTS
aws ssm put-parameter \
  --name "/event-registry-staging/ALLOWED_HOSTS" \
  --type "String" \
  --value "$ALB_DNS" \
  --overwrite

# Update CORS_ALLOWED_ORIGINS
aws ssm put-parameter \
  --name "/event-registry-staging/CORS_ALLOWED_ORIGINS" \
  --type "String" \
  --value "http://$ALB_DNS" \
  --overwrite

# Update FRONTEND_ORIGIN
aws ssm put-parameter \
  --name "/event-registry-staging/FRONTEND_ORIGIN" \
  --type "String" \
  --value "http://$ALB_DNS" \
  --overwrite

echo "SSM parameters updated with ALB DNS"
```

## Step 14: Run Initial Database Migrations

```bash
# Run migrations as one-off task
aws ecs run-task \
  --cluster event-registry-staging \
  --task-definition backend-task \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1],securityGroups=[$BACKEND_SG],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"backend","command":["python","manage.py","migrate"]}]}'

echo "Migration task started. Check CloudWatch logs for completion."
```

## Step 15: Build and Push Docker Images

### 15.1 Login to ECR

```bash
# Get login token
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $BACKEND_ECR_URI

echo "Logged in to ECR"
```

### 15.2 Build and Push Backend Image

```bash
# Build backend image
docker build -f backend/Dockerfile.prod -t event-registry-backend-staging ./backend

# Tag image
docker tag event-registry-backend-staging:latest $BACKEND_ECR_URI:latest

# Push image
docker push $BACKEND_ECR_URI:latest

echo "Backend image pushed"
```

### 15.3 Build and Push Frontend Image

```bash
# Build frontend image
docker build -f frontend/Dockerfile.prod -t event-registry-frontend-staging ./frontend

# Tag image
docker tag event-registry-frontend-staging:latest $FRONTEND_ECR_URI:latest

# Push image
docker push $FRONTEND_ECR_URI:latest

echo "Frontend image pushed"
```

## Step 16: Update ECS Services to Use New Images

```bash
# Force new deployment (will pull latest images)
aws ecs update-service \
  --cluster event-registry-staging \
  --service backend-service \
  --force-new-deployment

aws ecs update-service \
  --cluster event-registry-staging \
  --service frontend-service \
  --force-new-deployment

echo "Services updated. Wait for deployment to complete..."
```

## Step 17: Verify Deployment

### 17.1 Check Service Status

```bash
# Check backend service
aws ecs describe-services \
  --cluster event-registry-staging \
  --services backend-service \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'

# Check frontend service
aws ecs describe-services \
  --cluster event-registry-staging \
  --services frontend-service \
  --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
```

### 17.2 Test Health Checks

```bash
# Test backend health
curl http://$ALB_DNS/api/health

# Test frontend
curl http://$ALB_DNS/

echo "If you see responses, deployment is successful!"
```

### 17.3 Check CloudWatch Logs

```bash
# View backend logs
aws logs tail /ecs/event-registry-staging/backend --follow

# View frontend logs (in another terminal)
aws logs tail /ecs/event-registry-staging/frontend --follow
```

## Step 18: Configure GitHub Actions (Optional)

### 18.1 Add GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Add the following secrets:
   - `AWS_ACCESS_KEY_ID`: Your AWS access key
   - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key

### 18.2 Update GitHub Actions Workflow

```bash
# Update workflow file with actual subnet and security group IDs
# Edit .github/workflows/deploy-staging.yml
# Replace:
#   subnet-xxx, subnet-yyy → $PRIVATE_SUBNET_1, $PRIVATE_SUBNET_2
#   sg-xxx → $BACKEND_SG
```

## Step 19: Post-Deployment Tasks

### 19.1 Test Application

1. Visit: `http://$ALB_DNS`
2. Test login flow
3. Test image uploads
4. Test email sending (if configured)

### 19.2 Set Up HTTPS (Optional but Recommended)

```bash
# Request ACM certificate
aws acm request-certificate \
  --domain-name staging.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# After validation, create HTTPS listener
# See AWS documentation for HTTPS setup
```

### 19.3 Monitor Costs

- Set up AWS Cost Alerts
- Monitor CloudWatch metrics
- Review VPC Endpoint costs

## Troubleshooting

### Services Not Starting

```bash
# Check service events
aws ecs describe-services \
  --cluster event-registry-staging \
  --services backend-service \
  --query 'services[0].events[:5]'

# Check task status
aws ecs list-tasks \
  --cluster event-registry-staging \
  --service-name backend-service
```

### Health Checks Failing

```bash
# Check CloudWatch logs
aws logs tail /ecs/event-registry-staging/backend --since 10m

# Check target health
aws elbv2 describe-target-health --target-group-arn $BACKEND_TG_ARN
```

### Database Connection Issues

```bash
# Verify RDS is accessible
# Check security group rules
# Verify DATABASE_URL in SSM parameters
```

## Cost Optimization

### Scale Services to 0 When Not Testing

```bash
# Scale down
aws ecs update-service --cluster event-registry-staging --service backend-service --desired-count 0
aws ecs update-service --cluster event-registry-staging --service frontend-service --desired-count 0

# Scale up
aws ecs update-service --cluster event-registry-staging --service backend-service --desired-count 1
aws ecs update-service --cluster event-registry-staging --service frontend-service --desired-count 1
```

## Summary

Your application should now be deployed at: `http://$ALB_DNS`

**Next Steps:**
1. Test all functionality
2. Set up HTTPS with custom domain (optional)
3. Configure monitoring and alerts
4. Set up automated deployments via GitHub Actions

**Important URLs:**
- Application: `http://$ALB_DNS`
- Backend Health: `http://$ALB_DNS/api/health`
- CloudWatch Logs: AWS Console → CloudWatch → Log Groups

**Estimated Monthly Cost:** ~$40-60 (with services scaled to 0 when not in use)

