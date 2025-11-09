# Generated manually - Make phone required and unique per event
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0003_guest'),
    ]

    operations = [
        migrations.AlterField(
            model_name='guest',
            name='phone',
            field=models.CharField(max_length=20),
        ),
    ]

