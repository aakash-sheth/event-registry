"""
Tests for the LLM cost & abuse safety stack.

Covers every branch of `cost_safety.enforce_safety_stack` using a mix of
direct fakes (kill-switch via settings override) and `LLMUsageLedger`
fixtures (caps, quotas).

Idempotency, concurrency, and threshold-alert dedupe are exercised with
the real Django cache (``locmem`` backend in test settings).
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.events.models import LLMPlatformSettings, LLMUsageLedger
from apps.events.services import cost_safety
from apps.events.services.cost_safety import SafetyStackError, enforce_safety_stack


User = get_user_model()


def _ledger(*, user, cost, when=None, success=True, cache_hit=False, request_id="req-x"):
    """Convenience: backdate a ledger row to control window aggregation."""
    row = LLMUsageLedger.objects.create(
        user=user,
        request_id=request_id,
        operation="vision",
        provider="anthropic",
        model="claude-test",
        input_tokens=100,
        output_tokens=50,
        cost_usd=Decimal(str(cost)),
        cache_hit=cache_hit,
        success=success,
    )
    if when is not None:
        # auto_now_add field — bypass via UPDATE.
        LLMUsageLedger.objects.filter(pk=row.pk).update(created_at=when)
    return row


@override_settings(
    LLM_GENERATION_ENABLED=True,
    ANTHROPIC_API_KEY="sk-test",
    LLM_DAILY_COST_CAP_USD=10.0,
    LLM_MONTHLY_COST_CAP_USD=100.0,
    LLM_GENERATION_DAILY_PER_USER=5,
    LLM_GENERATION_MONTHLY_PER_USER=50,
    LLM_GENERATION_RATE_LIMIT_PER_MIN=60,  # 1/sec — keeps tests fast
)
class SafetyStackTests(TestCase):
    def setUp(self):
        cache.clear()
        LLMPlatformSettings.objects.filter(pk=1).delete()
        cache.delete('llm_platform_settings')
        self.user = User.objects.create_superuser(
            email="root@test.com", name="Root",
        )
        self.normal = User.objects.create_user(
            email="rando@test.com", name="Rando",
        )

    def test_blocks_anonymous(self):
        class _Anon:
            is_authenticated = False
            is_superuser = False
            id = None

        with self.assertRaises(SafetyStackError) as cm:
            enforce_safety_stack(user=_Anon(), request_id="r-anon")
        self.assertEqual(cm.exception.status_code, 401)
        self.assertEqual(cm.exception.code, "not_authenticated")

    def test_blocks_user_without_superuser_or_flag(self):
        with self.assertRaises(SafetyStackError) as cm:
            enforce_safety_stack(user=self.normal, request_id="r-normal")
        self.assertEqual(cm.exception.status_code, 403)
        self.assertEqual(cm.exception.code, "no_llm_access")

    def test_allows_user_with_llm_module_access(self):
        flagged = User.objects.create_user(
            email="flagged@test.com", name="Flagged",
        )
        flagged.llm_module_access = True
        flagged.save(update_fields=["llm_module_access"])
        ctx = enforce_safety_stack(user=flagged, request_id="r-flagged")
        self.assertEqual(ctx.user_id, flagged.id)
        self.assertIsNone(ctx.cached_response)

    @override_settings(LLM_GENERATION_ENABLED=False)
    def test_kill_switch_off_blocks(self):
        with self.assertRaises(SafetyStackError) as cm:
            enforce_safety_stack(user=self.user, request_id="r-kill")
        self.assertEqual(cm.exception.status_code, 503)
        self.assertEqual(cm.exception.code, "kill_switch_off")

    @override_settings(ANTHROPIC_API_KEY="")
    def test_missing_api_key_blocks(self):
        with self.assertRaises(SafetyStackError) as cm:
            enforce_safety_stack(user=self.user, request_id="r-key")
        self.assertEqual(cm.exception.status_code, 503)
        self.assertEqual(cm.exception.code, "missing_api_key")

    def test_daily_cap_exceeded_blocks(self):
        # Spend right up to the cap so preflight tips it over.
        _ledger(user=self.user, cost="9.99", when=timezone.now())
        with self.assertRaises(SafetyStackError) as cm:
            enforce_safety_stack(user=self.user, request_id="r-cap-d")
        self.assertEqual(cm.exception.status_code, 429)
        self.assertEqual(cm.exception.code, "daily_cost_cap")

    def test_monthly_cap_exceeded_blocks(self):
        # Park spend earlier in the *current* month (not N days ago — that can fall in the prior month).
        start_of_month = timezone.now().replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        _ledger(user=self.user, cost="99.99", when=start_of_month + timedelta(hours=1))
        with self.assertRaises(SafetyStackError) as cm:
            enforce_safety_stack(user=self.user, request_id="r-cap-m")
        self.assertEqual(cm.exception.status_code, 429)
        self.assertEqual(cm.exception.code, "monthly_cost_cap")

    def test_user_daily_limit_blocks(self):
        # Five distinct request_ids today — at the cap.
        for i in range(5):
            _ledger(
                user=self.user, cost="0.001",
                request_id=f"r-d-{i}",
                when=timezone.now(),
            )
        with self.assertRaises(SafetyStackError) as cm:
            enforce_safety_stack(user=self.user, request_id="r-d-new")
        self.assertEqual(cm.exception.status_code, 429)
        self.assertEqual(cm.exception.code, "user_daily_limit")

    def test_user_monthly_limit_blocks(self):
        # 50 distinct request_ids in the current month — at the cap.
        # Freeze "now" mid-month so ledger rows can span prior days without tripping today's daily cap.
        fixed_now = timezone.now().replace(day=15, hour=12, minute=0, second=0, microsecond=0)
        start_of_month = fixed_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        with patch("django.utils.timezone.now", return_value=fixed_now):
            for i in range(50):
                day_offset = i // 5
                _ledger(
                    user=self.user, cost="0.001",
                    request_id=f"r-m-{i}",
                    when=start_of_month + timedelta(days=day_offset, hours=(i % 5) + 1),
                )
            with self.assertRaises(SafetyStackError) as cm:
                enforce_safety_stack(user=self.user, request_id="r-m-new")
        self.assertEqual(cm.exception.status_code, 429)
        self.assertEqual(cm.exception.code, "user_monthly_limit")

    def test_idempotency_returns_cached_response(self):
        cost_safety.store_idempotent_response(
            self.user.id, "r-idempotent", {"echo": "ok", "n": 1}
        )
        ctx = enforce_safety_stack(user=self.user, request_id="r-idempotent")
        self.assertIsNotNone(ctx.cached_response)
        self.assertEqual(ctx.cached_response["echo"], "ok")

    def test_concurrency_lock_rejects_second_request(self):
        # Acquire the lock manually (simulating an in-flight request) then
        # try a second one — it must 429.
        with cost_safety.acquire_user_concurrency(self.user.id):
            with self.assertRaises(SafetyStackError) as cm:
                with cost_safety.acquire_user_concurrency(self.user.id):
                    pass  # pragma: no cover — should raise on enter
            self.assertEqual(cm.exception.status_code, 429)
            self.assertEqual(cm.exception.code, "concurrency_in_use")

    def test_threshold_alert_dedupes_within_window(self):
        # Spend at 90% of daily cap — well over the 80% threshold.
        _ledger(user=self.user, cost="9.0", when=timezone.now())
        with patch.object(
            cost_safety.alerting, "_send_email_safe"
        ) as send:
            # First call: alert should fire (daily threshold).
            try:
                enforce_safety_stack(user=self.user, request_id="r-alert-1")
            except SafetyStackError:
                # daily_spend + preflight may already exceed cap; that's OK.
                pass
            first_calls = send.call_count
            self.assertGreaterEqual(first_calls, 1)

            # Second call within window: no new send.
            try:
                enforce_safety_stack(user=self.user, request_id="r-alert-2")
            except SafetyStackError:
                pass
            self.assertEqual(send.call_count, first_calls)

    def test_happy_path_returns_context(self):
        ctx = enforce_safety_stack(user=self.user, request_id="r-happy")
        self.assertEqual(ctx.user_id, self.user.id)
        self.assertEqual(ctx.cached_response, None)
        # Spend is zero in a fresh DB.
        self.assertEqual(ctx.daily_spend_usd, Decimal("0"))

    def test_db_row_disables_generation_when_settings_enabled(self):
        """Singleton row wins over LLM_GENERATION_ENABLED from settings."""
        LLMPlatformSettings.objects.create(
            generation_enabled=False,
            daily_cost_cap_usd=Decimal("10.00"),
            monthly_cost_cap_usd=Decimal("100.00"),
        )
        with self.assertRaises(SafetyStackError) as cm:
            enforce_safety_stack(user=self.user, request_id="r-db-kill")
        self.assertEqual(cm.exception.status_code, 503)
        self.assertEqual(cm.exception.code, "kill_switch_off")

    def test_db_row_lowers_daily_cap(self):
        LLMPlatformSettings.objects.create(
            generation_enabled=True,
            daily_cost_cap_usd=Decimal("0.01"),
            monthly_cost_cap_usd=Decimal("100.00"),
        )
        with self.assertRaises(SafetyStackError) as cm:
            enforce_safety_stack(user=self.user, request_id="r-db-cap")
        self.assertEqual(cm.exception.code, "daily_cost_cap")

    def test_usage_summary_reflects_db_config(self):
        LLMPlatformSettings.objects.create(
            generation_enabled=False,
            daily_cost_cap_usd=Decimal("10.00"),
            monthly_cost_cap_usd=Decimal("100.00"),
        )
        summary = cost_safety.get_usage_summary(user=self.user)
        self.assertFalse(summary["kill_switch_enabled"])
        self.assertEqual(summary["daily"]["cap_usd"], 10.0)
        self.assertEqual(summary["monthly"]["cap_usd"], 100.0)

    def test_llm_platform_get_config_parses_image_hosts(self):
        LLMPlatformSettings.objects.create(
            generation_enabled=True,
            image_fetch_allowed_hosts="foo.example, BAR.com ",
            daily_cost_cap_usd=Decimal("10.00"),
            monthly_cost_cap_usd=Decimal("100.00"),
        )
        cfg = LLMPlatformSettings.get_config()
        self.assertEqual(cfg["image_fetch_allowed_hosts"], ["foo.example", "bar.com"])


@override_settings(
    LLM_VISION_MAX_INPUT_TOKENS=4000,
    LLM_VISION_MAX_OUTPUT_TOKENS=800,
    LLM_TEXT_MAX_INPUT_TOKENS=2000,
    LLM_TEXT_MAX_OUTPUT_TOKENS=1200,
    LLM_INPUT_PRICE_PER_MTOK_USD=3.0,
    LLM_OUTPUT_PRICE_PER_MTOK_USD=15.0,
)
class EstimateMaxRequestCostTests(TestCase):
    """Pre-flight estimate moves with token caps and prices."""

    def test_estimate_matches_token_caps(self):
        # vision: 4000*3 + 800*15 = 12000 + 12000 = 24000 (per-million-token base)
        # text:   2000*3 + 1200*15 = 6000 + 18000 = 24000
        # combined per-million unit = 48000; per-token = 48000 / 1e6 = 0.048
        # *1.2 multiplier = 0.0576
        estimate = cost_safety.estimate_max_request_cost_usd()
        self.assertEqual(estimate, Decimal("0.057600"))

    @override_settings(LLM_INPUT_PRICE_PER_MTOK_USD=6.0)
    def test_estimate_scales_with_price(self):
        # Doubled input price; output unchanged.
        # vision: 4000*6 + 800*15 = 24000 + 12000 = 36000
        # text:   2000*6 + 1200*15 = 12000 + 18000 = 30000
        # combined = 66000 / 1e6 = 0.066 * 1.2 = 0.0792
        estimate = cost_safety.estimate_max_request_cost_usd()
        self.assertEqual(estimate, Decimal("0.079200"))
