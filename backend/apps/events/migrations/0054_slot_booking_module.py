from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('events', '0053_add_show_branding_to_event'),
    ]

    operations = [
        migrations.CreateModel(
            name='BookingSchedule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_enabled', models.BooleanField(default=False)),
                ('seat_visibility_mode', models.CharField(choices=[('exact', 'Exact'), ('bucketed', 'Bucketed'), ('hidden', 'Hidden')], default='exact', max_length=20)),
                ('allow_direct_bookings', models.BooleanField(default=True)),
                ('allow_host_capacity_override', models.BooleanField(default=True)),
                ('booking_open_days_before', models.IntegerField(blank=True, null=True)),
                ('booking_close_hours_before', models.IntegerField(blank=True, null=True)),
                ('timezone', models.CharField(blank=True, default='', max_length=64)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='booking_schedule', to='events.event')),
            ],
            options={
                'db_table': 'booking_schedules',
            },
        ),
        migrations.CreateModel(
            name='BookingSlot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slot_date', models.DateField(help_text='Event timezone date for this slot')),
                ('start_at', models.DateTimeField(help_text='Stored in UTC')),
                ('end_at', models.DateTimeField(help_text='Stored in UTC')),
                ('label', models.CharField(blank=True, default='', max_length=255)),
                ('display_order', models.IntegerField(default=0)),
                ('capacity_total', models.IntegerField(default=1)),
                ('status', models.CharField(choices=[('available', 'Available'), ('unavailable', 'Unavailable'), ('sold_out', 'Sold Out'), ('hidden', 'Hidden')], default='available', max_length=20)),
                ('metadata_json', models.JSONField(blank=True, default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='booking_slots', to='events.event')),
                ('schedule', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='slots', to='events.bookingschedule')),
            ],
            options={
                'db_table': 'booking_slots',
                'ordering': ['slot_date', 'display_order', 'start_at'],
            },
        ),
        migrations.CreateModel(
            name='SlotBooking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('phone_snapshot', models.CharField(max_length=20)),
                ('name_snapshot', models.CharField(blank=True, default='', max_length=255)),
                ('email_snapshot', models.EmailField(blank=True, max_length=254, null=True)),
                ('seats_booked', models.IntegerField(default=1)),
                ('source', models.CharField(choices=[('invited', 'Invited'), ('direct', 'Direct')], default='direct', max_length=20)),
                ('status', models.CharField(choices=[('confirmed', 'Confirmed'), ('cancelled', 'Cancelled'), ('no_show', 'No Show')], default='confirmed', max_length=20)),
                ('idempotency_key', models.CharField(blank=True, max_length=100, null=True)),
                ('booked_at', models.DateTimeField(auto_now_add=True)),
                ('cancelled_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by_host', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_slot_bookings', to='users.user')),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='slot_bookings', to='events.event')),
                ('guest', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='slot_bookings', to='events.guest')),
                ('slot', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bookings', to='events.bookingslot')),
            ],
            options={
                'db_table': 'slot_bookings',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='messagecampaign',
            name='filter_booking_status',
            field=models.CharField(blank=True, default='', help_text='Only used when guest_filter = booking_status', max_length=20),
        ),
        migrations.AddField(
            model_name='messagecampaign',
            name='filter_slot_date',
            field=models.DateField(blank=True, help_text='Only used when guest_filter = booking_date', null=True),
        ),
        migrations.AddField(
            model_name='messagecampaign',
            name='filter_slot_id',
            field=models.IntegerField(blank=True, help_text='Only used when guest_filter = booking_slot', null=True),
        ),
        migrations.AddIndex(
            model_name='bookingslot',
            index=models.Index(fields=['event', 'slot_date', 'status'], name='bslot_evt_date_stat_idx'),
        ),
        migrations.AddIndex(
            model_name='bookingslot',
            index=models.Index(fields=['event', 'slot_date', 'display_order', 'start_at'], name='booking_slots_event_order_idx'),
        ),
        migrations.AddIndex(
            model_name='slotbooking',
            index=models.Index(fields=['event', 'slot', 'status'], name='sbook_evt_slot_stat_idx'),
        ),
        migrations.AddIndex(
            model_name='slotbooking',
            index=models.Index(fields=['event', 'guest'], name='slot_bookings_event_guest_idx'),
        ),
        migrations.AddIndex(
            model_name='slotbooking',
            index=models.Index(fields=['event', 'phone_snapshot'], name='slot_bookings_event_phone_idx'),
        ),
        migrations.AddConstraint(
            model_name='slotbooking',
            constraint=models.UniqueConstraint(condition=Q(guest__isnull=False, status='confirmed'), fields=('event', 'guest'), name='slot_bookings_event_guest_confirmed_unique'),
        ),
        migrations.AddConstraint(
            model_name='slotbooking',
            constraint=models.UniqueConstraint(condition=Q(guest__isnull=True, status='confirmed'), fields=('event', 'phone_snapshot'), name='slot_bookings_event_phone_confirmed_unique'),
        ),
        migrations.AddConstraint(
            model_name='slotbooking',
            constraint=models.UniqueConstraint(condition=Q(idempotency_key__isnull=False), fields=('event', 'idempotency_key'), name='slot_bookings_event_idempotency_unique'),
        ),
    ]
