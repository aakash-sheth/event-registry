# AWS SES Production Access Request

## Problem
AWS SES starts in **sandbox mode**, which requires:
- ✅ Verified FROM email address
- ❌ Verified recipient email addresses (not user-friendly!)

## Solution: Request Production Access

### Step 1: Go to AWS SES Console
1. Open: https://console.aws.amazon.com/ses/
2. Select region: **us-east-1** (or your SES region)
3. Click **"Account dashboard"** in the left menu

### Step 2: Request Production Access
1. Look for **"Sending statistics"** section
2. You'll see: **"Your account is in the Amazon SES sandbox"**
3. Click **"Request production access"** button

### Step 3: Fill Out the Request Form
AWS will ask for:

1. **Mail Type:**
   - Select: **Transactional** (for OTP emails, notifications)

2. **Website URL:**
   - Your staging URL: `http://staging-alb-33342285.us-east-1.elb.amazonaws.com`
   - Or your production domain if you have one

3. **Use case description:**
   ```
   We are building an event registry platform that sends:
   - OTP verification codes for user authentication
   - Order confirmations for gift purchases
   - Event notifications to hosts
   
   All emails are transactional and user-initiated.
   ```

4. **Compliance:**
   - ✅ Check: "I have read and agree to the AWS Service Terms"
   - ✅ Check: "I will only send emails to users who have opted in"

5. **Additional contact information:**
   - Your email address

### Step 4: Submit and Wait
- AWS typically approves within **24-48 hours**
- You'll receive an email when approved
- Once approved, you can send to **any email address** (no verification needed)

## Temporary Workaround (For Testing Now)

While waiting for production access, you can:

1. **Verify the FROM email:**
   ```bash
   aws ses verify-email-identity --email-address noreply@eventregistry.com --region us-east-1
   ```
   Then check your email and click the verification link.

2. **Verify test recipient emails:**
   ```bash
   aws ses verify-email-identity --email-address aakashsheth65@gmail.com --region us-east-1
   ```
   Check email and click verification link.

3. **Use a verified domain instead:**
   - If you own a domain, verify the entire domain
   - Then you can send from any email on that domain
   - Still need to verify recipients in sandbox mode though

## After Production Access is Approved

Once approved:
- ✅ No recipient verification needed
- ✅ Can send to any email address
- ✅ Higher sending limits (default: 50,000 emails/day)
- ✅ Better deliverability

## Check Current Status

```bash
# Check if production access is enabled
aws ses get-account-sending-enabled --region us-east-1

# List verified identities
aws ses list-identities --region us-east-1
```

