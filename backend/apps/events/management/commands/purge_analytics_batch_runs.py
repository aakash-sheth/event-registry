"""
Management command to purge old AnalyticsBatchRun records.

AnalyticsBatchRun rows accumulate without bound at roughly 48 rows/day (one per
30-minute batch). This command deletes rows older than a configurable retention
window, keeping the table small and queries fast.

Usage:
    # Dry-run: show how many rows would be deleted (safe to run any time)
    python manage.py purge_analytics_batch_runs --dry-run

    # Delete records older than 90 days (default)
    python manage.py purge_analytics_batch_runs

    # Delete records older than 30 days
    python manage.py purge_analytics_batch_runs --days 30

    # Keep the most recent N rows regardless of age
    python manage.py purge_analytics_batch_runs --keep 1000

Recommended: run weekly via cron or a scheduled ECS task.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from apps.events.models import AnalyticsBatchRun


class Command(BaseCommand):
    help = 'Delete AnalyticsBatchRun records older than a retention window to prevent unbounded table growth.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=90,
            help='Delete records whose collection_window_start is older than this many days (default: 90).',
        )
        parser.add_argument(
            '--keep',
            type=int,
            default=None,
            help=(
                'Always retain at least this many of the most recent records, '
                'even if they fall within the deletion window. '
                'Mutually exclusive with --days when both are provided: --keep takes precedence.'
            ),
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show how many rows would be deleted without actually deleting them.',
        )

    def handle(self, *args, **options):
        days = options['days']
        keep = options['keep']
        dry_run = options['dry_run']

        cutoff = timezone.now() - timedelta(days=days)

        total_rows = AnalyticsBatchRun.objects.count()
        self.stdout.write(f"Total AnalyticsBatchRun rows: {total_rows}")
        self.stdout.write(f"Retention window: {days} days (cutoff: {cutoff.strftime('%Y-%m-%d %H:%M:%S UTC')})")

        # Identify candidates for deletion
        candidates_qs = AnalyticsBatchRun.objects.filter(
            collection_window_start__lt=cutoff
        )
        candidates_count = candidates_qs.count()

        # If --keep is specified, exclude the N most recent rows from deletion
        if keep is not None:
            self.stdout.write(f"Retaining at least {keep} most recent rows.")
            # IDs of rows to preserve
            recent_ids = list(
                AnalyticsBatchRun.objects
                .order_by('-collection_window_start')
                .values_list('id', flat=True)[:keep]
            )
            candidates_qs = candidates_qs.exclude(id__in=recent_ids)
            candidates_count = candidates_qs.count()

        if candidates_count == 0:
            self.stdout.write(self.style.SUCCESS("No rows to delete. Table is within retention policy."))
            return

        self.stdout.write(
            self.style.WARNING(
                f"{'[DRY RUN] Would delete' if dry_run else 'Deleting'} "
                f"{candidates_count} rows older than {days} days."
            )
        )

        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry run complete. No rows deleted."))
            return

        deleted_count, _ = candidates_qs.delete()
        remaining = AnalyticsBatchRun.objects.count()

        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted_count} rows. {remaining} rows remain."
            )
        )
