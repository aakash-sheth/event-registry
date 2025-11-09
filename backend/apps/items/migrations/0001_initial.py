# Generated migration
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('events', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='RegistryItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('image_url', models.URLField(blank=True, null=True)),
                ('price_inr', models.IntegerField(help_text='Price in paise (e.g., 50000 = ₹500)')),
                ('qty_total', models.IntegerField(default=1)),
                ('qty_purchased', models.IntegerField(default=0)),
                ('priority_rank', models.IntegerField(default=0, help_text='Lower number = higher priority')),
                ('status', models.CharField(choices=[('active', 'Active'), ('hidden', 'Hidden')], default='active', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='events.event')),
            ],
            options={
                'db_table': 'registry_items',
                'ordering': ['priority_rank', 'name'],
            },
        ),
    ]

