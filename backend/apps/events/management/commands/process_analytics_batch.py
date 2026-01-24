"""
Django management command to process analytics batch
Usage: python manage.py process_analytics_batch
"""
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db.models import Avg
from apps.events.tasks import process_analytics_batch
from apps.events.models import AnalyticsBatchRun
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Process pending analytics views from cache and insert into database'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Force processing even if recent batch exists'
        )
        parser.add_argument(
            '--stats',
            action='store_true',
            help='Show statistics about recent batch runs'
        )

    def handle(self, *args, **options):
        if options['stats']:
            self.show_stats()
            return
        
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("PROCESSING ANALYTICS BATCH"))
        self.stdout.write("=" * 80)
        self.stdout.write()
        
        # Check if there's a recent batch run (within last 5 minutes)
        if not options['force']:
            recent_batch = AnalyticsBatchRun.objects.filter(
                processed_at__gte=timezone.now() - timedelta(minutes=5),
                status='completed'
            ).first()
            
            if recent_batch:
                self.stdout.write(
                    self.style.WARNING(
                        f"⚠️  Recent batch processed {recent_batch.processed_at.strftime('%Y-%m-%d %H:%M:%S')}. "
                        f"Use --force to process anyway."
                    )
                )
                return
        
        # Get batch interval setting
        batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
        self.stdout.write(f"Batch Interval: {batch_interval} minutes")
        self.stdout.write()
        
        # Process the batch
        try:
            self.stdout.write("Processing batch...")
            batch_run = process_analytics_batch()
            
            if batch_run:
                if batch_run.status == 'completed':
                    self.stdout.write(self.style.SUCCESS("✅ Batch processed successfully"))
                    self.stdout.write(f"   Run ID: {batch_run.run_id}")
                    self.stdout.write(f"   Views Collected: {batch_run.views_collected}")
                    self.stdout.write(f"   Views Deduplicated: {batch_run.views_deduplicated}")
                    self.stdout.write(f"   Views Inserted: {batch_run.views_inserted}")
                    self.stdout.write(f"   Invite Views: {batch_run.invite_views_count}")
                    self.stdout.write(f"   RSVP Views: {batch_run.rsvp_views_count}")
                    self.stdout.write(f"   Processing Time: {batch_run.processing_time_ms}ms")
                    
                    if batch_run.views_collected > 0:
                        dedup_rate = (1 - batch_run.views_deduplicated / batch_run.views_collected) * 100
                        self.stdout.write(f"   Deduplication Rate: {dedup_rate:.1f}%")
                elif batch_run.status == 'failed':
                    self.stdout.write(self.style.ERROR("❌ Batch processing failed"))
                    self.stdout.write(f"   Error: {batch_run.error_message}")
                else:
                    self.stdout.write(self.style.WARNING(f"⚠️  Batch status: {batch_run.status}"))
            else:
                self.stdout.write(self.style.ERROR("❌ Failed to process batch (no batch run created)"))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"❌ Error processing batch: {str(e)}"))
            import traceback
            self.stdout.write(traceback.format_exc())
    
    def show_stats(self):
        """Show statistics about recent batch runs"""
        self.stdout.write("=" * 80)
        self.stdout.write(self.style.SUCCESS("ANALYTICS BATCH STATISTICS"))
        self.stdout.write("=" * 80)
        self.stdout.write()
        
        # Get recent batches
        recent_batches = AnalyticsBatchRun.objects.all().order_by('-processed_at')[:20]
        
        if not recent_batches:
            self.stdout.write(self.style.WARNING("No batch runs found"))
            return
        
        # Summary statistics
        total_batches = AnalyticsBatchRun.objects.count()
        completed_batches = AnalyticsBatchRun.objects.filter(status='completed').count()
        failed_batches = AnalyticsBatchRun.objects.filter(status='failed').count()
        processing_batches = AnalyticsBatchRun.objects.filter(status='processing').count()
        
        self.stdout.write(self.style.SUCCESS("Summary:"))
        self.stdout.write(f"  Total Batches: {total_batches}")
        self.stdout.write(f"  Completed: {completed_batches}")
        self.stdout.write(f"  Failed: {failed_batches}")
        self.stdout.write(f"  Processing: {processing_batches}")
        
        if completed_batches > 0:
            success_rate = (completed_batches / total_batches) * 100
            self.stdout.write(f"  Success Rate: {success_rate:.1f}%")
        
        # Average statistics
        completed = AnalyticsBatchRun.objects.filter(status='completed')
        if completed.exists():
            avg_views = completed.aggregate(
                avg_collected=Avg('views_collected'),
                avg_inserted=Avg('views_inserted'),
                avg_time=Avg('processing_time_ms')
            )
            self.stdout.write()
            self.stdout.write(self.style.SUCCESS("Averages (completed batches):"))
            self.stdout.write(f"  Avg Views Collected: {avg_views['avg_collected']:.0f}")
            self.stdout.write(f"  Avg Views Inserted: {avg_views['avg_inserted']:.0f}")
            self.stdout.write(f"  Avg Processing Time: {avg_views['avg_time']:.0f}ms")
        
        # Recent batches table
        self.stdout.write()
        self.stdout.write(self.style.SUCCESS("Recent Batch Runs:"))
        self.stdout.write("-" * 80)
        self.stdout.write(f"{'Run ID':<25} {'Status':<12} {'Collected':<10} {'Inserted':<10} {'Time (ms)':<12} {'Processed At':<20}")
        self.stdout.write("-" * 80)
        
        for batch in recent_batches:
            status_color = {
                'completed': self.style.SUCCESS,
                'failed': self.style.ERROR,
                'processing': self.style.WARNING,
                'pending': self.style.WARNING,
            }.get(batch.status, lambda x: x)
            
            processed_str = batch.processed_at.strftime('%Y-%m-%d %H:%M:%S') if batch.processed_at else 'N/A'
            time_str = f"{batch.processing_time_ms}ms" if batch.processing_time_ms else 'N/A'
            
            self.stdout.write(
                f"{batch.run_id[:24]:<25} "
                f"{status_color(batch.status):<12} "
                f"{batch.views_collected:<10} "
                f"{batch.views_inserted:<10} "
                f"{time_str:<12} "
                f"{processed_str:<20}"
            )
        
        self.stdout.write()
