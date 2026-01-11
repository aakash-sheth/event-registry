# Database Relationship Diagram

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Event : "hosts"
    Event ||--|| InvitePage : "has"
    Event ||--o{ Guest : "has"
    Event ||--o{ RSVP : "receives"
    Event ||--o{ RegistryItem : "contains"
    Event ||--o{ Order : "has"
    Guest ||--o{ RSVP : "matches"
    RegistryItem ||--o{ Order : "purchased_as"
    
    User {
        int id PK
        string email UK
        string name
        boolean is_active
        boolean is_staff
        boolean is_superuser
        datetime created_at
        boolean email_verified
        string otp_code
        datetime otp_expires_at
    }
    
    Event {
        int id PK
        int host_id FK
        string slug UK
        string title
        string event_type
        date date
        string city
        string country
        boolean is_public
        boolean has_rsvp
        boolean has_registry
        text banner_image
        text description
        json additional_photos
        json page_config
        date expiry_date
        text whatsapp_message_template
        datetime created_at
        datetime updated_at
    }
    
    InvitePage {
        int id PK
        int event_id FK "OneToOne"
        string slug UK
        text background_url
        json config
        boolean is_published
        datetime created_at
        datetime updated_at
    }
    
    Guest {
        int id PK
        int event_id FK
        string name
        string phone
        string country_iso
        string email
        string relationship
        text notes
        boolean is_removed
        datetime created_at
        datetime updated_at
    }
    
    RSVP {
        int id PK
        int event_id FK
        int guest_id FK "nullable"
        string name
        string phone
        string email
        string will_attend
        int guests_count
        text notes
        string source_channel
        boolean is_removed
        datetime created_at
        datetime updated_at
    }
    
    RegistryItem {
        int id PK
        int event_id FK
        string name
        text description
        string image_url
        int price_inr
        int qty_total
        int qty_purchased
        int priority_rank
        string status
        string item_type
        datetime created_at
        datetime updated_at
    }
    
    Order {
        int id PK
        int event_id FK
        int item_id FK "nullable"
        string buyer_name
        string buyer_email
        string buyer_phone
        int amount_inr
        string status
        string provider
        string rzp_order_id
        string rzp_payment_id
        string rzp_signature
        boolean opt_in_whatsapp
        string preferred_lang
        datetime created_at
        datetime updated_at
    }
    
    NotificationLog {
        int id PK
        string channel
        string to
        string template
        json payload_json
        string status
        text last_error
        datetime created_at
    }
```

## Relationship Summary

### Core Relationships

1. **User → Event** (One-to-Many)
   - A User can host multiple Events
   - Each Event belongs to one User (host)
   - Foreign Key: `Event.host_id` → `User.id`

2. **Event → InvitePage** (One-to-One)
   - Each Event has exactly one InvitePage
   - Each InvitePage belongs to one Event
   - Foreign Key: `InvitePage.event_id` → `Event.id`

3. **Event → Guest** (One-to-Many)
   - An Event can have many Guests
   - Each Guest belongs to one Event
   - Foreign Key: `Guest.event_id` → `Event.id`
   - Unique Constraint: `(event_id, phone)`

4. **Event → RSVP** (One-to-Many)
   - An Event can receive many RSVPs
   - Each RSVP belongs to one Event
   - Foreign Key: `RSVP.event_id` → `Event.id`
   - Unique Constraint: `(event_id, phone)`

5. **Event → RegistryItem** (One-to-Many)
   - An Event can have many RegistryItems
   - Each RegistryItem belongs to one Event
   - Foreign Key: `RegistryItem.event_id` → `Event.id`

6. **Event → Order** (One-to-Many)
   - An Event can have many Orders
   - Each Order belongs to one Event
   - Foreign Key: `Order.event_id` → `Event.id`

### Cross-Entity Relationships

7. **Guest → RSVP** (One-to-Many, Optional)
   - A Guest can have multiple RSVPs (if they update their response)
   - An RSVP can optionally be linked to a Guest (if the RSVP matches an invited guest)
   - Foreign Key: `RSVP.guest_id` → `Guest.id` (nullable)

8. **RegistryItem → Order** (One-to-Many, Optional)
   - A RegistryItem can have many Orders (multiple purchases)
   - An Order can optionally be linked to a RegistryItem (for physical gifts)
   - Foreign Key: `Order.item_id` → `RegistryItem.id` (nullable)
   - Note: Orders can exist without items (for cash gifts or donations)

### Standalone Entities

9. **NotificationLog**
   - No foreign key relationships
   - Standalone logging table for email/WhatsApp notifications

## Key Constraints

- **Unique Constraints:**
  - `User.email` - unique
  - `Event.slug` - unique
  - `InvitePage.slug` - unique
  - `(Event, phone)` - unique for Guest
  - `(Event, phone)` - unique for RSVP

- **Soft Deletes:**
  - `Guest.is_removed` - soft delete flag
  - `RSVP.is_removed` - soft delete flag

- **Nullable Foreign Keys:**
  - `RSVP.guest_id` - nullable (RSVP can exist without matching Guest)
  - `Order.item_id` - nullable (Orders for cash/donations don't need items)

## Database Tables

All models use custom table names:
- `users` (User)
- `events` (Event)
- `invite_pages` (InvitePage)
- `guests` (Guest)
- `rsvps` (RSVP)
- `registry_items` (RegistryItem)
- `orders` (Order)
- `notification_logs` (NotificationLog)



