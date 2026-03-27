from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0052_add_message_campaigns'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='show_branding',
            field=models.BooleanField(
                default=True,
                help_text="Show 'Powered by EkFern' branding on public invite pages (disable for paid plans)",
            ),
        ),
    ]
