# Generated manually
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='RSVP',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('phone', models.CharField(max_length=20)),
                ('email', models.EmailField(blank=True, max_length=254, null=True)),
                ('will_attend', models.CharField(choices=[('yes', 'Yes'), ('no', 'No'), ('maybe', 'Maybe')], max_length=10)),
                ('guests_count', models.IntegerField(default=1, help_text='Total guests including the respondent')),
                ('notes', models.TextField(blank=True)),
                ('source_channel', models.CharField(choices=[('qr', 'QR Code'), ('link', 'Web Link'), ('manual', 'Manual')], default='link', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rsvps', to='events.event')),
            ],
            options={
                'db_table': 'rsvps',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='rsvp',
            unique_together={('event', 'phone')},
        ),
    ]

