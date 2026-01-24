# Generated migration for AnalyticsBatchRun model
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0040_create_analytics_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='AnalyticsBatchRun',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('run_id', models.CharField(help_text='Unique identifier for this batch run', max_length=100, unique=True)),
                ('started_at', models.DateTimeField(help_text='When batch collection period started')),
                ('processed_at', models.DateTimeField(blank=True, help_text='When batch was processed', null=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('views_collected', models.IntegerField(default=0, help_text='Total views collected from cache')),
                ('views_deduplicated', models.IntegerField(default=0, help_text='Views after deduplication')),
                ('views_inserted', models.IntegerField(default=0, help_text='Views actually inserted to database')),
                ('invite_views_count', models.IntegerField(default=0, help_text='Number of invite views in this batch')),
                ('rsvp_views_count', models.IntegerField(default=0, help_text='Number of RSVP views in this batch')),
                ('processing_time_ms', models.IntegerField(blank=True, help_text='Processing time in milliseconds', null=True)),
                ('error_message', models.TextField(blank=True, help_text='Error message if processing failed', null=True)),
                ('metadata', models.JSONField(blank=True, default=dict, help_text='Additional statistics and metadata')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'analytics_batch_runs',
                'ordering': ['-started_at'],
            },
        ),
        migrations.AddIndex(
            model_name='analyticsbatchrun',
            index=models.Index(fields=['status', '-started_at'], name='batch_runs_status_idx'),
        ),
        migrations.AddIndex(
            model_name='analyticsbatchrun',
            index=models.Index(fields=['-processed_at'], name='batch_runs_processed_idx'),
        ),
    ]
