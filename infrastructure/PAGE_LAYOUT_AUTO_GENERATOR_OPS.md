# Page Layout Auto-Generator — Ops Runbook

This document covers the operator-side setup required before flipping
`LLM_GENERATION_ENABLED=True` for the Page Layout Auto-Generator.

The feature itself is fully implemented and ships with the kill-switch
**OFF**. Generation will return HTTP 503 to every caller (even superusers)
until you complete the steps below and explicitly enable it per environment.

> Layered-defense reminder: the workspace-level cap configured in step 1.3
> is the single most important defense. Even if every app-side cap, rate
> limit, and ledger check fails, Anthropic refuses to spend more than this
> amount per month.

## 1. Anthropic console setup (per environment)

Repeat per Anthropic workspace (you currently ship one AWS stack branded
“staging ECS” — treat its SSM prefix as canonical). **The Anthropic billing account is
separate from any claude.ai subscription** — that subscription does not
fund API calls.

1. Sign in to [console.anthropic.com](https://console.anthropic.com) using
   a shared ekfern operations email (NOT a personal account).
2. **Create a dedicated workspace.** Name it `ekfern-page-layouts-prod`
   (or `…-staging`). Workspaces give independent billing, keys, and caps.
3. **Set the workspace monthly spend cap.**
    * Production: **$20 / month**
    * Staging: **$5 / month**
4. **Configure usage alerts** at **50% / 80% / 100%** of the workspace
   cap, sent to a monitored alias (e.g. `ops@ekfern.com`).
5. **Generate a workspace-scoped API key** named
   `ekfern-page-layouts-prod` (or `…-staging`). Do **not** use an
   organisation-wide key.
6. **Add billing**: prepaid credit (Anthropic minimum $5–$10) on a
   **dedicated, low-limit payment method**. A virtual card with a $50/month
   ceiling is ideal — never the corporate primary card.
7. **Verify the key works** with a one-off test call (any small
   `messages.create`) and confirm the call appears in the workspace usage
   dashboard.
8. **Document who has access** to the Anthropic console (≤ 2 superusers).
   Rotate keys at least quarterly.

Until all eight steps are done for an environment, leave
`LLM_GENERATION_ENABLED=False` for that environment.

## 2. Move `ANTHROPIC_API_KEY` to AWS Secrets Manager / SSM

The key is a long-lived secret. Store it in SSM Parameter Store (matching
the rest of the backend's secrets pattern) — never in `.env`, the task
definition, or git.

### 2.1 Create the SSM parameter

```bash
# Required for the live ECS backend (staging stack / single deploy today).
aws ssm put-parameter \
  --name /event-registry-staging/ANTHROPIC_API_KEY \
  --type SecureString \
  --value "sk-ant-…" \
  --description "Anthropic API key (Page Layout Generator)"

# If you later split a dedicated prod AWS stack, duplicate under /event-registry-prod/...
```

Repeat for other optional staging toggles (only if you want to manage them outside the task-definition `environment` block):

```bash
aws ssm put-parameter --name /event-registry-staging/LLM_GENERATION_ENABLED --type String --value "True" --overwrite
aws ssm put-parameter --name /event-registry-staging/LLM_COST_ALERT_EMAIL  --type String --value "ops@ekfern.com"
```

### 2.2 Grant the ECS execution role read access

The execution role referenced by `infrastructure/ecs-task-definitions/backend-task-definition.json`
(`arn:…:role/ecsTaskExecutionRole`) needs `ssm:GetParameters` and
`kms:Decrypt` on the new parameter ARNs. Add them to the role's policy:

```json
{
  "Effect": "Allow",
  "Action": ["ssm:GetParameters"],
  "Resource": [
    "arn:aws:ssm:us-east-1:630147069059:parameter/event-registry-staging/ANTHROPIC_API_KEY"
  ]
}
```

(Add a second resource ARN later if you introduce `/event-registry-prod/` parameters.)
### 2.3 Reference the secret from the task definition

The staging deploy workflow **registers** [`backend-task-definition.json`](ecs-task-definitions/backend-task-definition.json) on each deploy, then points `backend-service` at that revision so **SSM secrets** (including `ANTHROPIC_API_KEY`) stay attached.


### 2.4 Verification

After deploy, hit the cost dashboard endpoint as a superuser:

```
GET /api/admin/llm-usage/summary
```

Expected response fields:

```json
{
  "kill_switch_enabled": true,
  "api_key_configured": true,
  "models": { "vision": "claude-sonnet-4-5", "text": "claude-sonnet-4-5" },
  ...
}
```

If `api_key_configured` is `false`, the SSM parameter isn't reaching the
container — recheck IAM and the task-definition `secrets` block.

## 3. Operational levers

Once enabled, these are the controls available without a code deploy:

| Action                       | How                                                           |
|------------------------------|---------------------------------------------------------------|
| Halt generation immediately  | `aws ssm put-parameter --name …/LLM_GENERATION_ENABLED --value False --overwrite` then redeploy |
| Lower daily cap              | Edit `LLM_DAILY_COST_CAP_USD` in the task def (or SSM if migrated) |
| Lower monthly cap            | Edit `LLM_MONTHLY_COST_CAP_USD`                               |
| Rotate the API key           | Generate new key in Anthropic console, update SSM parameter, redeploy |
| Rebuild the cost dashboard   | `GET /api/admin/llm-usage/summary?days=N`                     |
| Clean up untouched drafts    | `python manage.py cleanup_layout_drafts --days 30`            |

The `cleanup_layout_drafts` command is safe to wire to a daily ECS
scheduled task; it is idempotent and only deletes
`status='draft', visibility='internal'` rows older than the given window.

## 4. When to roll back

If you see any of:
* unexpected daily spend > $5
* repeated `kill_switch_off` errors after enable
* alert emails firing inside ten minutes of enable

…flip the kill-switch off (Section 3, row 1), inspect the recent calls in
`/host/templates/layouts/llm-usage`, and check the `LLMUsageLedger` rows
in Postgres for the offending request_id before re-enabling.
