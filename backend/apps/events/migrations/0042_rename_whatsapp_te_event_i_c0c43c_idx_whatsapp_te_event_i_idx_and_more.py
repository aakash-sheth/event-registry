# Generated migration - Rename indexes to match model definition
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0041_create_analytics_batch_run'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='messagetemplate',
            old_name='whatsapp_te_event_i_c0c43c_idx',
            new_name='whatsapp_te_event_i_idx',
        ),
        migrations.RenameIndex(
            model_name='messagetemplate',
            old_name='whatsapp_te_event_i_74bedc_idx',
            new_name='whatsapp_te_event_i_idx2',
        ),
        migrations.RenameIndex(
            model_name='messagetemplate',
            old_name='whatsapp_te_event_i_683f48_idx',
            new_name='whatsapp_te_event_i_idx3',
        ),
        migrations.RenameIndex(
            model_name='messagetemplate',
            old_name='whatsapp_te_is_syst_e230e8_idx',
            new_name='whatsapp_te_is_syst_idx',
        ),
    ]
