# AWS Infrastructure Setup

This directory contains scripts and documentation for setting up the AWS staging environment.

## Prerequisites

1. AWS CLI installed and configured
2. Appropriate AWS permissions (IAM user with admin or specific permissions)
3. AWS region selected (default: us-east-1)

## Setup Steps

### 1. VPC and Networking

Run the VPC setup script or use AWS Console:

```bash
# Create VPC with public/private subnets
# See infrastructure/vpc-setup.sh for automated setup
```

Or manually:
- Create VPC (CIDR: 10.0.0.0/16)
- Create 2 public subnets (for ALB)
- Create 2 private subnets (for ECS + RDS)
- Create Internet Gateway
- Configure route tables
- Create security groups

### 2. VPC Endpoints

Create VPC Endpoints for AWS services:

```bash
# S3 Gateway Endpoint (free)
aws ec2 create-vpc-endpoint \
  --vpc-id <vpc-id> \
  --service-name com.amazonaws.us-east-1.s3 \
  --route-table-ids <private-subnet-route-table-id>

# ECR Interface Endpoint
aws ec2 create-vpc-endpoint \
  --vpc-id <vpc-id> \
  --service-name com.amazonaws.us-east-1.ecr.dkr \
  --subnet-ids <private-subnet-1> <private-subnet-2> \
  --security-group-ids <vpc-endpoint-sg>

# SES Interface Endpoint
aws ec2 create-vpc-endpoint \
  --vpc-id <vpc-id> \
  --service-name com.amazonaws.us-east-1.email \
  --subnet-ids <private-subnet-1> <private-subnet-2> \
  --security-group-ids <vpc-endpoint-sg>
```

### 3. RDS Database

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
  --no-multi-az
```

### 4. ECR Repositories

```bash
aws ecr create-repository --repository-name event-registry-backend-staging
aws ecr create-repository --repository-name event-registry-frontend-staging
```

### 5. S3 Bucket

```bash
aws s3 mb s3://event-registry-staging-uploads
# Configure bucket policy, CORS, and lifecycle policies
```

### 6. SSM Parameters

Use the script in `infrastructure/setup-ssm-parameters.sh` or manually create parameters:

```bash
aws ssm put-parameter \
  --name "/event-registry-staging/DJANGO_SECRET_KEY" \
  --type "SecureString" \
  --value "<your-secret-key>"
```

### 7. IAM Roles

Create IAM task roles for ECS with appropriate permissions for S3, SES, and SSM.

### 8. ECS Cluster and Services

Create ECS cluster, task definitions, and services. See `infrastructure/ecs-task-definitions/` for examples.

### 9. Application Load Balancer

Create ALB with target groups and listener rules for path-based routing.

## Cost Optimization

- Scale services to 0 when not in use
- Use single AZ for RDS (staging only)
- 14-day CloudWatch log retention
- VPC Endpoints instead of NAT Gateway

## Notes

- Update subnet IDs and security group IDs in scripts before running
- Store sensitive values in SSM Parameter Store, not in scripts
- Review and adjust resource sizes based on actual usage

