import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0049_analytics_indexes'),
    ]

    operations = [
        migrations.CreateModel(
            name='RegistryPageView',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('viewed_at', models.DateTimeField(help_text='When the guest viewed the registry page')),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='registry_views', to='events.event')),
                ('guest', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='registry_views', to='events.guest')),
            ],
            options={
                'ordering': ['-viewed_at'],
            },
        ),
        migrations.AddIndex(
            model_name='registrypageview',
            index=models.Index(fields=['event', 'guest'], name='registry_views_event_guest_idx'),
        ),
        migrations.AddConstraint(
            model_name='registrypageview',
            constraint=models.UniqueConstraint(fields=['guest', 'event', 'viewed_at'], name='registry_views_unique_guest_event_time'),
        ),
    ]
