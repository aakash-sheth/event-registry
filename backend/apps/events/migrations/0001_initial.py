# Generated migration
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Event',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(max_length=100, unique=True)),
                ('title', models.CharField(max_length=255)),
                ('event_type', models.CharField(choices=[('wedding', 'Wedding'), ('engagement', 'Engagement'), ('reception', 'Reception'), ('other', 'Other')], default='wedding', max_length=50)),
                ('date', models.DateField(blank=True, null=True)),
                ('city', models.CharField(blank=True, max_length=255)),
                ('is_public', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('host', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='events', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'events',
                'ordering': ['-created_at'],
            },
        ),
    ]

