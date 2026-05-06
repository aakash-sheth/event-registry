import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0074_whatsappsettings'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='WaitlistEntry',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('feature_slug', models.CharField(help_text="Identifier for the feature (e.g. 'bulk_whatsapp')", max_length=100)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('event', models.ForeignKey(blank=True, help_text='Optional — the event context where interest was expressed', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='events.event')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='waitlist_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Waitlist Entry',
                'verbose_name_plural': 'Waitlist Entries',
                'db_table': 'waitlist_entries',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='waitlistentry',
            unique_together={('user', 'feature_slug')},
        ),
    ]
