from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0067_migrate_meta_approved_templates'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='messagetemplate',
            constraint=models.UniqueConstraint(
                condition=models.Q(event__isnull=False),
                fields=['event', 'name', 'channel'],
                name='unique_template_name_per_event_channel',
            ),
        ),
    ]
