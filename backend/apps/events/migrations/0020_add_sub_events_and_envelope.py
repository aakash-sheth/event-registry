# Generated migration
from django.db import migrations, models
import django.db.models.deletion
import secrets


def generate_guest_tokens(apps, schema_editor):
    """Generate guest tokens for existing guests"""
    Guest = apps.get_model('events', 'Guest')
    for guest in Guest.objects.filter(guest_token__isnull=True):
        guest.guest_token = secrets.token_urlsafe(32)
        guest.save(update_fields=['guest_token'])


def reverse_generate_guest_tokens(apps, schema_editor):
    """Reverse migration - set guest tokens to None"""
    Guest = apps.get_model('events', 'Guest')
    Guest.objects.all().update(guest_token=None)


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0019_alter_event_expiry_date_and_template'),
    ]

    operations = [
        # Add new fields to Event model
        migrations.AddField(
            model_name='event',
            name='event_structure',
            field=models.CharField(
                choices=[('SIMPLE', 'Simple'), ('ENVELOPE', 'Envelope')],
                default='SIMPLE',
                help_text='SIMPLE: single event, ENVELOPE: event with sub-events',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='rsvp_mode',
            field=models.CharField(
                choices=[('PER_SUBEVENT', 'Per Sub-Event'), ('ONE_TAP_ALL', 'One Tap All')],
                default='ONE_TAP_ALL',
                help_text='PER_SUBEVENT: RSVP per sub-event, ONE_TAP_ALL: single confirmation for all',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='event_end_date',
            field=models.DateField(blank=True, help_text='End date for multi-day events (optional)', null=True),
        ),
        
        # Create SubEvent model
        migrations.CreateModel(
            name='SubEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('start_at', models.DateTimeField()),
                ('end_at', models.DateTimeField(blank=True, null=True)),
                ('location', models.CharField(blank=True, max_length=500)),
                ('description', models.TextField(blank=True, null=True)),
                ('image_url', models.TextField(blank=True, null=True)),
                ('rsvp_enabled', models.BooleanField(default=True)),
                ('is_public_visible', models.BooleanField(default=False, help_text='Visible on public invite links without guest token')),
                ('is_removed', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sub_events', to='events.event')),
            ],
            options={
                'db_table': 'sub_events',
                'ordering': ['start_at'],
            },
        ),
        
        # Create GuestSubEventInvite model
        migrations.CreateModel(
            name='GuestSubEventInvite',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('guest', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sub_event_invites', to='events.guest')),
                ('sub_event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='guest_invites', to='events.subevent')),
            ],
            options={
                'db_table': 'guest_sub_event_invites',
                'unique_together': {('guest', 'sub_event')},
            },
        ),
        
        # Add guest_token to Guest model
        migrations.AddField(
            model_name='guest',
            name='guest_token',
            field=models.CharField(blank=True, db_index=True, help_text='Random token for guest-specific invite links', max_length=64, null=True, unique=True),
        ),
        
        # Generate guest tokens for existing guests
        migrations.RunPython(generate_guest_tokens, reverse_generate_guest_tokens),
        
        # Add sub_event to RSVP model
        migrations.AddField(
            model_name='rsvp',
            name='sub_event',
            field=models.ForeignKey(blank=True, help_text='NULL for SIMPLE events, set for ENVELOPE events', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='rsvps', to='events.subevent'),
        ),
        
        # Note: We need to handle the unique constraint carefully because sub_event can be NULL
        # For SIMPLE events, sub_event will be NULL, so we need (event, phone) to be unique when sub_event is NULL
        # For ENVELOPE events, sub_event is set, so we need (event, phone, sub_event) to be unique
        # 
        # Django's unique_together doesn't handle NULL values well, so we'll:
        # 1. Remove the old unique constraint
        # 2. Add the new constraint (Django will create it, but NULL handling varies by database)
        # 3. Rely on application-level validation for proper NULL handling
        
        # Remove old unique constraint
        migrations.AlterUniqueTogether(
            name='rsvp',
            unique_together=set(),
        ),
        
        # Add new unique constraint
        # Note: This works for PostgreSQL (treats NULL as distinct), but for SQLite/MySQL
        # we may need additional application-level validation
        migrations.AlterUniqueTogether(
            name='rsvp',
            unique_together={('event', 'phone', 'sub_event')},
        ),
    ]

