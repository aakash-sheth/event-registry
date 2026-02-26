from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0044_single_canonical_attribution_links'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='analytics_enabled_at',
            field=models.DateTimeField(blank=True, help_text='Timestamp when host enabled attribution insights visibility.', null=True),
        ),
        migrations.AddField(
            model_name='event',
            name='analytics_enabled_by',
            field=models.ForeignKey(blank=True, help_text='Host user who enabled attribution insights visibility.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='analytics_enabled_events', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='event',
            name='analytics_insights_enabled',
            field=models.BooleanField(default=False, help_text='Controls host visibility of attribution insights; tracking collection remains active.'),
        ),
    ]
