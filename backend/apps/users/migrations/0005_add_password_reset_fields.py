# Generated migration
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_groups_user_user_permissions'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='password_reset_token',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='password_reset_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='user',
            name='failed_password_attempts',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='user',
            name='account_locked_until',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

