# Generated migration
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0013_add_whatsapp_template'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='expiry_date',
            field=models.DateField(
                blank=True,
                null=True,
                help_text='Event expiry date. If not set, defaults to event date. Host can extend this to reactivate expired events.'
            ),
        ),
    ]



