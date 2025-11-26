# Staging Deployment Readiness Checklist

## ✅ Code Preparation - COMPLETE

### Backend
- [x] Production Dockerfile created (`backend/Dockerfile.prod`)
  - Uses gunicorn with 2 workers
  - Proper timeout settings
  - Production optimizations

- [x] Gunicorn added to requirements (`backend/requirements.txt`)
  - Version: 21.2.0

- [x] Entrypoint script updated (`backend/entrypoint.sh`)
  - Removed hardcoded `db` hostname
  - Parses DATABASE_URL or uses DB_HOST
  - Collects static files
  - Runs migrations
  - Uses gunicorn

- [x] Health check endpoint (`backend/apps/common/views.py`)
  - `/health` and `/api/health` endpoints
  - Database connectivity check
  - Returns 200 if healthy, 503 if unhealthy

- [x] Static files configuration (`backend/registry_backend/urls.py`)
  - Serves static files in production

- [x] Security settings (`backend/registry_backend/settings.py`)
  - HTTPS/SSL settings
  - Secure cookies
  - Security headers
  - Conditional on DEBUG=False

### Frontend
- [x] Production Dockerfile created (`frontend/Dockerfile.prod`)
  - Multi-stage build
  - Uses `npm ci` for clean install
  - Production build with `npm run build`
  - Production server with `npm start`
  - Copies necessary config files

- [x] Environment variable handling
  - Uses `NEXT_PUBLIC_API_BASE` correctly
  - Configured in ECS task definition

## ✅ Infrastructure Files - COMPLETE

- [x] GitHub Actions workflow (`.github/workflows/deploy-staging.yml`)
  - Builds and pushes to ECR
  - Updates ECS services
  - Runs migrations
  - Verifies health checks

- [x] ECS Task Definitions
  - Backend task definition with SSM parameter references
  - Frontend task definition with SSM parameter references
  - Health checks configured
  - CloudWatch logging configured

- [x] SSM Parameter Setup Script (`infrastructure/setup-ssm-parameters.sh`)
  - Interactive script for creating all parameters
  - Handles secure and non-secure parameters

- [x] S3 Configuration Files
  - CORS configuration
  - Lifecycle policy (IA after 30 days)

- [x] IAM Policy Templates
  - Backend task role policy
  - Frontend task role policy

- [x] Documentation
  - Infrastructure README
  - Deployment guide
  - Setup summary

## ⚠️ Manual AWS Setup Required

The following must be completed in AWS Console/CLI:

1. **VPC and Networking**
   - [ ] Create VPC (10.0.0.0/16)
   - [ ] Create 2 public subnets (for ALB)
   - [ ] Create 2 private subnets (for ECS + RDS)
   - [ ] Create Internet Gateway
   - [ ] Configure route tables
   - [ ] Create security groups

2. **VPC Endpoints**
   - [ ] S3 Gateway Endpoint
   - [ ] ECR Interface Endpoint
   - [ ] SES Interface Endpoint
   - [ ] SSM Interface Endpoint (optional)

3. **RDS Database**
   - [ ] Create PostgreSQL t4g.micro instance
   - [ ] Configure in private subnet
   - [ ] Set up security groups
   - [ ] Note DATABASE_URL for SSM

4. **ECR Repositories**
   - [ ] Create `wedding-registry-backend-staging`
   - [ ] Create `wedding-registry-frontend-staging`

5. **S3 Bucket**
   - [ ] Create bucket
   - [ ] Apply CORS policy
   - [ ] Apply lifecycle policy
   - [ ] Configure bucket policy for public-read objects

6. **SSM Parameters**
   - [ ] Run `infrastructure/setup-ssm-parameters.sh`
   - [ ] Or create manually via AWS Console
   - [ ] Verify all parameters are created

7. **IAM Roles**
   - [ ] Create ECS task execution role
   - [ ] Create backend task role (with S3/SES/SSM permissions)
   - [ ] Create frontend task role (with SSM permissions)
   - [ ] Attach policies

8. **CloudWatch Log Groups**
   - [ ] Create `/ecs/wedding-registry-staging/backend`
   - [ ] Create `/ecs/wedding-registry-staging/frontend`
   - [ ] Set 14-day retention

9. **ECS Setup**
   - [ ] Create cluster `wedding-registry-staging`
   - [ ] Update task definition JSON files (ACCOUNT_ID, REGION, subnet IDs, SG IDs)
   - [ ] Register task definitions
   - [ ] Create backend service
   - [ ] Create frontend service

10. **Application Load Balancer**
    - [ ] Create ALB in public subnets
    - [ ] Create backend target group (port 8000)
    - [ ] Create frontend target group (port 3000)
    - [ ] Configure listener rules:
      - `/api/*` → backend
      - `/*` → frontend
    - [ ] Configure HTTPS listener
    - [ ] Set up HTTP to HTTPS redirect
    - [ ] Enable access logs to S3

11. **Initial Migrations**
    - [ ] Run one-off ECS task to execute migrations
    - [ ] Verify migrations completed successfully

12. **GitHub Secrets**
    - [ ] Add `AWS_ACCESS_KEY_ID`
    - [ ] Add `AWS_SECRET_ACCESS_KEY`
    - [ ] Verify workflow has access

## 🔍 Pre-Deployment Verification

Before deploying, verify:

- [ ] All placeholder values updated (ACCOUNT_ID, REGION, subnet IDs, SG IDs)
- [ ] SSM parameters contain correct values
- [ ] IAM roles have correct permissions
- [ ] Security groups allow necessary traffic
- [ ] VPC Endpoints are configured correctly
- [ ] RDS is accessible from ECS tasks
- [ ] S3 bucket is accessible from ECS tasks
- [ ] ALB DNS name is stored in SSM (`/registry-staging/ALB_DNS`)

## 🚀 Deployment Steps

1. Complete all manual AWS setup items above
2. Update task definition JSON files with actual values
3. Register task definitions in ECS
4. Create ECS services
5. Configure ALB and target groups
6. Run initial migrations
7. Configure GitHub secrets
8. Push to main branch (or trigger workflow manually)
9. Monitor deployment in GitHub Actions
10. Verify application is accessible via ALB URL
11. Test health check endpoints
12. Test image uploads (S3)
13. Test email sending (SES)

## 📝 Notes

- All code changes are complete and ready
- All infrastructure configuration files are ready
- Manual AWS setup is required (cannot be automated without AWS credentials)
- Follow `infrastructure/DEPLOYMENT.md` for detailed step-by-step instructions
- Use `infrastructure/setup-ssm-parameters.sh` for SSM parameter setup

## ✅ Status: READY FOR STAGING

**Code is production-ready. Infrastructure files are ready. Manual AWS setup required.**

