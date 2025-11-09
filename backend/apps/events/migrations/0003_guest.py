# Generated manually
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0002_rsvp'),
    ]

    operations = [
        migrations.CreateModel(
            name='Guest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('phone', models.CharField(max_length=20)),
                ('email', models.EmailField(blank=True, max_length=254, null=True)),
                ('relationship', models.CharField(blank=True, help_text='e.g., Family, Friends, Colleagues', max_length=100)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='guest_list', to='events.event')),
            ],
            options={
                'db_table': 'guests',
                'ordering': ['name'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='guest',
            unique_together={('event', 'phone')},
        ),
        migrations.AddField(
            model_name='rsvp',
            name='guest',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='rsvps', to='events.guest'),
        ),
    ]

