from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0064_guestsegment_type_and_filter'),
    ]

    operations = [
        # 1. Make event FK nullable (event=NULL means EkFern-owned global template)
        migrations.AlterField(
            model_name='messagetemplate',
            name='event',
            field=models.ForeignKey(
                blank=True,
                help_text='NULL = EkFern-owned global template; set = host-owned template',
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='message_templates',
                to='events.event',
            ),
        ),

        # 2. New channel / meta / email fields
        migrations.AddField(
            model_name='messagetemplate',
            name='channel',
            field=models.CharField(
                choices=[('whatsapp', 'WhatsApp'), ('email', 'Email')],
                default='whatsapp',
                help_text='Delivery channel this template targets',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='messagetemplate',
            name='meta_approved',
            field=models.BooleanField(
                default=False,
                help_text='True if this template is registered and approved in Meta Business Manager',
            ),
        ),
        migrations.AddField(
            model_name='messagetemplate',
            name='meta_template_name',
            field=models.CharField(
                blank=True,
                help_text='Exact template name in Meta Business Manager',
                max_length=200,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='messagetemplate',
            name='meta_template_language',
            field=models.CharField(
                blank=True,
                help_text='Language code for the Meta template (e.g. en, hi)',
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='messagetemplate',
            name='is_live',
            field=models.BooleanField(
                default=True,
                help_text='Global templates only: visible to hosts when True AND meta_approved=True',
            ),
        ),
        migrations.AddField(
            model_name='messagetemplate',
            name='subject',
            field=models.CharField(
                blank=True,
                help_text='Email subject line (channel=email only)',
                max_length=500,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='messagetemplate',
            name='is_rich_text',
            field=models.BooleanField(
                default=False,
                help_text='If True, template_text is HTML; if False, plain text (email only)',
            ),
        ),

        # 3. Remove old unique_together on (event, name) — will add partial constraint in 0068
        migrations.AlterUniqueTogether(
            name='messagetemplate',
            unique_together=set(),
        ),

        # 4. Remove old index names that reference the old table prefix
        migrations.RemoveIndex(
            model_name='messagetemplate',
            name='whatsapp_te_event_i_idx',
        ),
        migrations.RemoveIndex(
            model_name='messagetemplate',
            name='whatsapp_te_event_i_idx2',
        ),
        migrations.RemoveIndex(
            model_name='messagetemplate',
            name='whatsapp_te_event_i_idx3',
        ),
        migrations.RemoveIndex(
            model_name='messagetemplate',
            name='whatsapp_te_is_syst_idx',
        ),

        # 5. Add replacement indexes with new names
        migrations.AddIndex(
            model_name='messagetemplate',
            index=models.Index(fields=['event', 'channel'], name='msgtpl_event_channel_idx'),
        ),
        migrations.AddIndex(
            model_name='messagetemplate',
            index=models.Index(fields=['event', 'message_type'], name='msgtpl_event_msgtype_idx'),
        ),
        migrations.AddIndex(
            model_name='messagetemplate',
            index=models.Index(fields=['meta_approved', 'is_live'], name='msgtpl_approved_live_idx'),
        ),
        migrations.AddIndex(
            model_name='messagetemplate',
            index=models.Index(fields=['is_system_default'], name='msgtpl_sysdefault_idx'),
        ),

        # 6. Rename table from whatsapp_templates to message_templates
        migrations.AlterModelTable(
            name='messagetemplate',
            table='message_templates',
        ),
    ]
