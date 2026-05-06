from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0063_add_guest_segment'),
    ]

    operations = [
        migrations.AddField(
            model_name='guestsegment',
            name='segment_type',
            field=models.CharField(
                choices=[('fixed', 'Fixed'), ('dynamic', 'Dynamic')],
                default='fixed',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='guestsegment',
            name='filter_config',
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
