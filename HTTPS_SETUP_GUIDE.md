# HTTPS Setup Guide for Staging

## Overview
This guide explains how to set up HTTPS for the staging ALB. HTTPS requires an SSL certificate from AWS Certificate Manager (ACM).

## Prerequisites

### Option 1: Custom Domain (Recommended)
- A domain name (e.g., `yourdomain.com`)
- Ability to add DNS records (Route 53 or external DNS provider)
- Create a subdomain like `staging.yourdomain.com`

### Option 2: ALB DNS (Limited)
- ACM certificates **cannot** be issued for ALB DNS names (e.g., `staging-alb-33342285.us-east-1.elb.amazonaws.com`)
- You would need a custom domain or use Route 53 to create a subdomain

## Step 1: Request ACM Certificate

### Option A: Using a Custom Domain

```bash
# Request certificate for your domain
aws acm request-certificate \
  --domain-name staging.yourdomain.com \
  --validation-method DNS \
  --region us-east-1

# Get certificate ARN
CERT_ARN=$(aws acm list-certificates \
  --region us-east-1 \
  --query 'CertificateSummaryList[?DomainName==`staging.yourdomain.com`].CertificateArn' \
  --output text)

# Get DNS validation records
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --output json
```

**Add DNS validation record** to your domain's DNS:
- Type: CNAME
- Name: (from ResourceRecord.Name)
- Value: (from ResourceRecord.Value)

Wait for certificate status to become `ISSUED` (check in ACM console).

### Option B: Using Route 53 (If domain is in Route 53)

```bash
# Request certificate
CERT_ARN=$(aws acm request-certificate \
  --domain-name staging.yourdomain.com \
  --validation-method DNS \
  --region us-east-1 \
  --query 'CertificateArn' \
  --output text)

# Get hosted zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name yourdomain.com \
  --query 'HostedZones[0].Id' \
  --output text | cut -d'/' -f3)

# Get validation record
VALIDATION_RECORD=$(aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --output json)

# Create validation record in Route 53 (automated)
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"CREATE\",
      \"ResourceRecordSet\": {
        \"Name\": $(echo $VALIDATION_RECORD | jq -r '.Name'),
        \"Type\": \"CNAME\",
        \"TTL\": 300,
        \"ResourceRecords\": [{\"Value\": $(echo $VALIDATION_RECORD | jq -r '.Value')}]
      }
    }]
  }"
```

## Step 2: Configure ALB HTTPS Listener

### Get ALB and Target Group ARNs

```bash
# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names staging-alb \
  --region us-east-1 \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

# Get HTTP listener ARN
HTTP_LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn $ALB_ARN \
  --region us-east-1 \
  --query 'Listeners[?Port==`80`].ListenerArn' \
  --output text)

# Get target group ARNs
FRONTEND_TG_ARN=$(aws elbv2 describe-listeners \
  --listener-arns $HTTP_LISTENER_ARN \
  --region us-east-1 \
  --query 'Listeners[0].DefaultActions[0].TargetGroupArn' \
  --output text)

BACKEND_TG_ARN=$(aws elbv2 describe-rules \
  --listener-arn $HTTP_LISTENER_ARN \
  --region us-east-1 \
  --query 'Rules[?Conditions[0].Values[0]==`/api/*`].Actions[0].TargetGroupArn' \
  --output text)
```

### Create HTTPS Listener

```bash
# Create HTTPS listener (port 443)
HTTPS_LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=$CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN \
  --region us-east-1 \
  --query 'Listeners[0].ListenerArn' \
  --output text)

# Add /api/* rule to HTTPS listener
aws elbv2 create-rule \
  --listener-arn $HTTPS_LISTENER_ARN \
  --priority 100 \
  --conditions Field=path-pattern,Values='/api/*' \
  --actions Type=forward,TargetGroupArn=$BACKEND_TG_ARN \
  --region us-east-1
```

### Configure HTTP to HTTPS Redirect

```bash
# Update HTTP listener to redirect to HTTPS
aws elbv2 modify-listener \
  --listener-arn $HTTP_LISTENER_ARN \
  --default-actions Type=redirect,RedirectConfig='{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' \
  --region us-east-1
```

## Step 3: Update SSM Parameters

```bash
# Set your domain (or ALB DNS if using custom domain)
DOMAIN="staging.yourdomain.com"  # or use ALB DNS if no custom domain
ALB_URL="https://${DOMAIN}"

# Update SSM parameters
aws ssm put-parameter \
  --name "/event-registry-staging/NEXT_PUBLIC_API_BASE" \
  --value "$ALB_URL" \
  --type "String" \
  --overwrite

aws ssm put-parameter \
  --name "/event-registry-staging/ALLOWED_HOSTS" \
  --value "$DOMAIN" \
  --type "String" \
  --overwrite

aws ssm put-parameter \
  --name "/event-registry-staging/CORS_ALLOWED_ORIGINS" \
  --value "$ALB_URL" \
  --type "String" \
  --overwrite

aws ssm put-parameter \
  --name "/event-registry-staging/FRONTEND_ORIGIN" \
  --value "$ALB_URL" \
  --type "String" \
  --overwrite
```

## Step 4: Update GitHub Actions Workflow

The workflow will automatically use HTTPS if the SSM parameter uses `https://`. The workflow reads from SSM:

```yaml
# In .github/workflows/deploy-staging.yml
ALB_DNS=$(aws ssm get-parameter --name "/event-registry-staging/ALB_DNS" --query "Parameter.Value" --output text)
# If NEXT_PUBLIC_API_BASE is set to https://, it will be used
```

## Step 5: Rebuild and Redeploy

After updating SSM parameters, trigger a new deployment:

```bash
# Push a commit or manually trigger the workflow
git commit --allow-empty -m "Trigger deployment with HTTPS"
git push
```

## Quick Setup Script

Use the automated script:

```bash
cd infrastructure
./setup-https.sh
```

The script will:
1. Request ACM certificate
2. Wait for validation
3. Create HTTPS listener
4. Configure HTTP → HTTPS redirect
5. Provide commands to update SSM parameters

## Verification

```bash
# Test HTTPS endpoint
curl -I https://staging.yourdomain.com/api/health

# Check certificate
openssl s_client -connect staging.yourdomain.com:443 -servername staging.yourdomain.com
```

## Troubleshooting

### Certificate Not Issued
- Check DNS validation records are correct
- Wait 5-10 minutes for DNS propagation
- Verify certificate status in ACM console

### HTTPS Not Working
- Verify certificate is attached to HTTPS listener
- Check security group allows port 443
- Verify ALB is in public subnets

### Mixed Content Errors
- Ensure all URLs use `https://`
- Check `NEXT_PUBLIC_API_BASE` uses HTTPS
- Verify CORS settings allow HTTPS origin

## Notes

- **Certificate must be in `us-east-1`** (same region as ALB)
- **ACM certificates are free** (no cost)
- **HTTP → HTTPS redirect** is automatic after setup
- **Custom domain required** (ACM doesn't support ALB DNS names)

