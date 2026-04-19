from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0059_alter_messagecampaign_guest_filter'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='InviteDesignTemplate',
            new_name='InvitePageLayout',
        ),
        migrations.AlterModelTable(
            name='invitepagelayout',
            table='invite_page_layouts',
        ),
        migrations.RenameIndex(
            model_name='invitepagelayout',
            old_name='invite_dt_visibility_idx',
            new_name='invite_pl_visibility_idx',
        ),
        migrations.RenameIndex(
            model_name='invitepagelayout',
            old_name='invite_dt_status_idx',
            new_name='invite_pl_status_idx',
        ),
        migrations.RenameIndex(
            model_name='invitepagelayout',
            old_name='invite_dt_vis_status_idx',
            new_name='invite_pl_vis_status_idx',
        ),
    ]
