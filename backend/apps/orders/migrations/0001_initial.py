# Generated migration
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('events', '0001_initial'),
        ('items', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Order',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('buyer_name', models.CharField(max_length=255)),
                ('buyer_email', models.EmailField(max_length=254)),
                ('buyer_phone', models.CharField(blank=True, max_length=20)),
                ('amount_inr', models.IntegerField(help_text='Amount in paise')),
                ('status', models.CharField(choices=[('created', 'Created'), ('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed'), ('refunded', 'Refunded')], default='created', max_length=20)),
                ('provider', models.CharField(default='razorpay', max_length=50)),
                ('rzp_order_id', models.CharField(blank=True, max_length=255, null=True)),
                ('rzp_payment_id', models.CharField(blank=True, max_length=255, null=True)),
                ('rzp_signature', models.CharField(blank=True, max_length=255, null=True)),
                ('opt_in_whatsapp', models.BooleanField(default=False)),
                ('preferred_lang', models.CharField(blank=True, default='en', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='orders', to='events.event')),
                ('item', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='orders', to='items.registryitem')),
            ],
            options={
                'db_table': 'orders',
                'ordering': ['-created_at'],
            },
        ),
    ]

