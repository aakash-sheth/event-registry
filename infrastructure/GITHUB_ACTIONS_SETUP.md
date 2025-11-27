# GitHub Actions Workflow Setup Guide

## Quick Setup Steps

### Step 1: Get AWS Resource IDs

After setting up AWS infrastructure, run:

```bash
cd infrastructure
./get-aws-values.sh
```

This will show you all the values you need.

### Step 2: Add GitHub Secrets

Go to: **GitHub → Settings → Secrets and variables → Actions → New repository secret**

Add these **required** secrets:

1. **AWS_ACCESS_KEY_ID** - Your AWS access key
2. **AWS_SECRET_ACCESS_KEY** - Your AWS secret key

Add these **optional** secrets (recommended for security):

3. **ECS_PRIVATE_SUBNET_1** - First private subnet ID (e.g., `subnet-0abc123def456`)
4. **ECS_PRIVATE_SUBNET_2** - Second private subnet ID (e.g., `subnet-0xyz789ghi012`)
5. **ECS_BACKEND_SECURITY_GROUP** - Backend security group ID (e.g., `sg-0abc123def456`)

**Note:** If you don't add the subnet/SG secrets, the workflow will fail with a clear error message telling you what to do.

### Step 3: Verify Prerequisites

Before running the workflow, ensure these exist:

#### ✅ ECR Repositories
```bash
aws ecr describe-repositories --repository-names event-registry-backend-staging
aws ecr describe-repositories --repository-names event-registry-frontend-staging
```

If missing, create them:
```bash
aws ecr create-repository --repository-name event-registry-backend-staging
aws ecr create-repository --repository-name event-registry-frontend-staging
```

#### ✅ ECS Cluster
```bash
aws ecs describe-clusters --clusters event-registry-staging
```

If missing:
```bash
aws ecs create-cluster --cluster-name event-registry-staging
```

#### ✅ Task Definitions
```bash
aws ecs describe-task-definition --task-definition backend-task
aws ecs describe-task-definition --task-definition frontend-task
```

If missing, register them (see AWS_DEPLOYMENT_GUIDE.md Step 10).

**Note:** `backend-migration-task` is optional - the workflow will use `backend-task` if migration task doesn't exist.

#### ✅ ECS Services
```bash
aws ecs describe-services --cluster event-registry-staging --services backend-service frontend-service
```

If missing, create them (see AWS_DEPLOYMENT_GUIDE.md Step 11).

#### ✅ SSM Parameter
```bash
aws ssm get-parameter --name "/event-registry-staging/ALB_DNS"
```

If missing, create it:
```bash
# Get ALB DNS
ALB_DNS=$(aws elbv2 describe-load-balancers --names staging-alb --query 'LoadBalancers[0].DNSName' --output text)

# Create parameter
aws ssm put-parameter \
  --name "/event-registry-staging/ALB_DNS" \
  --type "String" \
  --value "$ALB_DNS"
```

### Step 4: Test the Workflow

1. **Manual test:** GitHub → Actions → "Deploy to AWS Staging" → "Run workflow"
2. **Automatic:** Push any change to `main` branch

## Troubleshooting

### "Credentials could not be loaded"
- ✅ Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets are set
- ✅ Verify credentials have proper AWS permissions

### "Subnet or Security Group secrets not set"
- ✅ Add `ECS_PRIVATE_SUBNET_1`, `ECS_PRIVATE_SUBNET_2`, and `ECS_BACKEND_SECURITY_GROUP` to GitHub secrets
- ✅ Or update workflow file line 64 directly with actual values

### "Repository not found"
- ✅ Create ECR repositories (see Step 3 above)

### "Service not found"
- ✅ Create ECS services (see AWS_DEPLOYMENT_GUIDE.md)

### "Task definition not found"
- ✅ Register task definitions (see AWS_DEPLOYMENT_GUIDE.md)

## Alternative: Update Workflow File Directly

If you prefer not to use GitHub secrets for subnet/SG IDs, you can update the workflow file directly:

1. Run `./get-aws-values.sh` to get the values
2. Edit `.github/workflows/deploy-staging.yml` line 64
3. Replace `subnet-xxx`, `subnet-yyy`, `sg-xxx` with actual values

**Note:** This is less secure as values will be visible in the workflow file.

