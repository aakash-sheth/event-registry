# Generated migration
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('items', '0002_alter_registryitem_image_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='registryitem',
            name='item_type',
            field=models.CharField(
                choices=[('physical', 'Physical Gift'), ('cash', 'Cash Gift'), ('donation', 'Donation/Fundraiser')],
                default='physical',
                help_text='Type of gift item - physical (paper saved on gift cards), cash (no paper), or donation',
                max_length=20
            ),
        ),
    ]



