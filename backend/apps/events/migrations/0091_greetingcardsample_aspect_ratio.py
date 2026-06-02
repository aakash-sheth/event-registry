from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0090_invitepagelayout_card_sample'),
    ]

    operations = [
        migrations.AddField(
            model_name='greetingcardsample',
            name='aspect_ratio',
            field=models.CharField(
                choices=[
                    ('9:16', '9:16 — Portrait phone'),
                    ('1:1',  '1:1 — Square'),
                    ('4:5',  '4:5 — Instagram portrait'),
                    ('3:4',  '3:4 — Standard portrait'),
                    ('16:9', '16:9 — Landscape'),
                ],
                default='9:16',
                help_text='Canvas aspect ratio for this design (e.g. 9:16, 1:1).',
                max_length=10,
            ),
        ),
    ]
