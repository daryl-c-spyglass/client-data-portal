# Lovable Migration Handoff — Spyglass Realty Client Data Portal

Comprehensive handoff document for migrating the Client Data Portal from Replit.

---

## 1. ENVIRONMENT VARIABLES

### Required (Production)

| Variable | Description | Example Format | Required |
|----------|-------------|----------------|----------|
| `DATABASE_URL` | PostgreSQL (Neon) connection string | `postgresql://user:pass@host:5432/db?sslmode=require` | **Yes** |
| `SESSION_SECRET` | Session encryption key (32+ chars) | `a-long-random-string-at-least-32-chars` | **Yes** |
| `NODE_ENV` | Runtime environment | `production` | **Yes** |

### Strongly Recommended

| Variable | Description | Example Format | Required |
|----------|-------------|----------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `123456789.apps.googleusercontent.com` | No (login disabled without) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `GOCSPX-xxxxxxxx` | No (login disabled without) |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL (production) | `https://yourdomain.com/auth/google/callback` | No (auto-detected on Replit) |
| `REPLIERS_API_KEY` | Repliers MLS API key | `your-repliers-api-key` | No (property search disabled without) |
| `MAPBOX_ACCESS_TOKEN` | Mapbox server-side token | `pk.xxxxxxxx` | No (geocoding disabled without) |
| `VITE_MAPBOX_TOKEN` | Mapbox client-side token (public) | `pk.xxxxxxxx` | No (maps disabled without) |

### Optional Integrations

| Variable | Description | Example Format | Required |
|----------|-------------|----------------|----------|
| `MLSGRID_API_URL` | MLS Grid API base URL | `https://api.mlsgrid.com/v2` | No |
| `MLS_GRID_BBO` | MLS Grid BBO API token | `Bearer xxxxxxxx` | No |
| `MLS_GRID_VOW` | MLS Grid VOW API token | `Bearer xxxxxxxx` | No |
| `FUB_API_KEY` | Follow Up Boss API key | `fub-api-key-here` | No |
| `FUB_TRACKER_ID` | Follow Up Boss tracker pixel ID | `tracker-id` | No |
| `REZEN_API_KEY` | ReZen (Mission Control) API key | `rezen-key` | No |
| `OPENAI_API_KEY` | OpenAI API key (GPT-4o) | `sk-xxxxxxxx` | No |
| `RESEND_API_KEY` | Resend email service key | `re_xxxxxxxx` | No |
| `ALLOWED_EMAIL_DOMAIN` | Domain restriction for login | `spyglassrealty.com` (default) | No |
| `ALLOWED_EMAILS` | Comma-separated override emails | `user1@gmail.com,user2@gmail.com` | No |
| `HOMEREVIEW_API_URL` | HomeReview API base URL | `https://homereview-api.example.com` | No |
| `WORDPRESS_DOMAIN` | WordPress site for widget integration | `www.spyglassrealty.com` | No |
| `SLACK_LIVE_API_KEY` | Slack webhook for notifications | `xoxb-xxxxxxxx` | No |

### Replit-Specific (Not needed on Lovable/Vercel)

| Variable | Description |
|----------|-------------|
| `REPLIT_DOMAINS` | Auto-set by Replit for domain detection |
| `REPLIT_DEV_DOMAIN` | Auto-set by Replit for dev domain |
| `REPL_ID` | Auto-set Repl identifier |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Replit Object Storage bucket |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Replit Object Storage public paths |
| `PRIVATE_OBJECT_DIR` | Replit Object Storage private dir |

> **Note**: Replit Object Storage is used for CMA brochure uploads. On Lovable/Vercel, you'll need to replace with Supabase Storage, AWS S3, or similar.

---

## 2. DATABASE SCHEMA

### ORM: Drizzle ORM with PostgreSQL (Neon serverless driver)

Schema file: `shared/schema.ts`

Drizzle config: `drizzle.config.ts` — outputs migrations to `./migrations/`, uses `DATABASE_URL`.

### Tables Overview

| Table | Purpose | Key Relationships |
|-------|---------|-------------------|
| `properties` | MLS property listings (RESO Data Dictionary compliant) | Referenced by `media.resource_record_key` |
| `media` | Property photos/media | FK: `resource_record_key` → properties |
| `users` | Authenticated users (Google OAuth + local) | Referenced by many tables |
| `admin_activity_logs` | Audit trail for admin actions | FK: `admin_user_id` → users, `target_user_id` → users |
| `saved_searches` | User's saved search criteria | Optional FK: `user_id` → users |
| `cmas` | Comparative Market Analysis reports | FK: `user_id` → users |
| `cma_report_configs` | Per-CMA presentation settings | FK: `cma_id` → cmas (unique, cascade delete) |
| `cma_report_templates` | Reusable CMA presentation templates | FK: `user_id` → users (cascade delete) |
| `seller_updates` | Automated seller market update configs | FK: `user_id` → users |
| `seller_update_send_history` | Email send history for seller updates | FK: `seller_update_id` → seller_updates (cascade delete) |
| `display_preferences` | Global display formatting preferences | None |
| `lead_gate_settings` | Registration wall config for property views | None |
| `wp_favorites` | WordPress user property favorites | None (external WordPress user IDs) |
| `neighborhood_boundaries` | Cached neighborhood boundary polygons | None |
| `sync_metadata` | MLS Grid sync state tracking | None |

### Detailed Column Definitions

#### `properties`
```
id                                    VARCHAR  PK
listing_id                            TEXT     NOT NULL, UNIQUE
mlg_can_view                          BOOLEAN  NOT NULL, DEFAULT true
modification_timestamp                TIMESTAMP NOT NULL
originating_system_modification_timestamp TIMESTAMP
list_price                            DECIMAL(14,2)
close_price                           DECIMAL(14,2)
standard_status                       TEXT     -- Active, Pending, Closed, Active Under Contract
property_type                         TEXT
property_sub_type                     TEXT
unparsed_address                      TEXT
street_number                         TEXT
street_name                           TEXT
unit_number                           TEXT
city                                  TEXT
state_or_province                     TEXT
postal_code                           TEXT
latitude                              DECIMAL(10,7)
longitude                             DECIMAL(10,7)
subdivision                           TEXT
neighborhood                          TEXT
county_or_parish                      TEXT
bedrooms_total                        INTEGER
main_level_bedrooms                   INTEGER
bathrooms_total_integer               INTEGER
bathrooms_full                        INTEGER
bathrooms_half                        INTEGER
living_area                           DECIMAL(10,2)
lot_size_square_feet                  DECIMAL(14,2)
lot_size_acres                        DECIMAL(10,4)
year_built                            INTEGER
stories_total                         INTEGER
property_condition                    TEXT[]
garage_parking_spaces                 INTEGER
total_parking_spaces                  INTEGER
parking_features                      TEXT[]
days_on_market                        INTEGER
listing_contract_date                 TIMESTAMP
close_date                            TIMESTAMP
price_change_timestamp                TIMESTAMP
elementary_school                     TEXT
middle_or_junior_school               TEXT
high_school                           TEXT
school_district                       TEXT
public_remarks                        TEXT
private_remarks                       TEXT
mls_id                                TEXT
mls_area_major                        TEXT
list_agent_mls_id                     TEXT
list_office_mls_id                    TEXT
flex_listing_yn                       BOOLEAN
property_sale_contingency             TEXT
special_listing_conditions            TEXT[]
showing_requirements                  TEXT[]
occupant_type                         TEXT
possession                            TEXT
buyer_financing                       TEXT[]
association_yn                        BOOLEAN
ownership_type                        TEXT
pool_private_yn                       BOOLEAN
pool_features                         TEXT[]
spa_features                          TEXT[]
waterfront_yn                         BOOLEAN
waterfront_features                   TEXT[]
view_yn                               BOOLEAN
view                                  TEXT[]
horse_yn                              BOOLEAN
horse_amenities                       TEXT[]
interior_features                     TEXT[]
flooring                              TEXT[]
fireplace_features                    TEXT[]
window_features                       TEXT[]
accessibility_features                TEXT[]
security_features                     TEXT[]
exterior_features                     TEXT[]
foundation_details                    TEXT[]
lot_features                          TEXT[]
fencing                               TEXT[]
patio_and_porch_features              TEXT[]
community_features                    TEXT[]
heating                               TEXT[]
cooling                               TEXT[]
water_source                          TEXT[]
sewer                                 TEXT[]
utilities                             TEXT[]
green_energy_efficient                TEXT[]
green_sustainability                  TEXT[]
green_building_verification_type      TEXT[]
green_verification_metric             TEXT
green_verification_status             TEXT[]
green_verification_rating             TEXT
green_verification_year               INTEGER
additional_data                       JSON
```

#### `media`
```
id                     VARCHAR  PK
media_key              TEXT     NOT NULL, UNIQUE
resource_record_key    TEXT     NOT NULL
media_url              TEXT     NOT NULL
media_category         TEXT
media_type             TEXT
order                  INTEGER
caption                TEXT
modification_timestamp TIMESTAMP NOT NULL
local_path             TEXT
```

#### `users`
```
id              VARCHAR  PK, DEFAULT gen_random_uuid()
email           TEXT     NOT NULL, UNIQUE
password_hash   TEXT     -- NULL for Google OAuth users
role            TEXT     NOT NULL, DEFAULT 'agent'  -- developer|super_admin|admin|agent
first_name      TEXT
last_name       TEXT
phone           TEXT
company         TEXT
license_number  TEXT
google_id       TEXT     UNIQUE
picture         TEXT
last_login_at   TIMESTAMP
is_active       BOOLEAN  NOT NULL, DEFAULT true
created_at      TIMESTAMP NOT NULL, DEFAULT NOW()
updated_at      TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `cmas`
```
id                      VARCHAR  PK, DEFAULT gen_random_uuid()
user_id                 VARCHAR  FK → users.id (SET NULL on delete)
name                    TEXT     NOT NULL
subject_property_id     TEXT
comparable_property_ids JSON     NOT NULL  -- string[]
properties_data         JSON     -- cached property data from API
search_criteria         JSON
notes                   TEXT
public_link             TEXT     UNIQUE
brochure                JSON     -- CmaBrochure type
adjustments             JSON     -- CmaAdjustmentsData type
expires_at              TIMESTAMP
created_at              TIMESTAMP NOT NULL, DEFAULT NOW()
updated_at              TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `cma_report_configs`
```
id                      VARCHAR  PK, DEFAULT gen_random_uuid()
cma_id                  VARCHAR  NOT NULL, FK → cmas.id (CASCADE), UNIQUE
included_sections       JSON     -- string[]
section_order           JSON     -- string[]
cover_letter_override   TEXT
layout                  TEXT     DEFAULT 'two_photos'
template                TEXT     DEFAULT 'default'
theme                   TEXT     DEFAULT 'spyglass'
photo_layout            TEXT     DEFAULT 'first_dozen'
map_style               TEXT     DEFAULT 'streets'
show_map_polygon        BOOLEAN  DEFAULT true
include_agent_footer    BOOLEAN  DEFAULT true
cover_page_config       JSON     -- CoverPageConfig type
custom_photo_selections JSON     -- Record<string, string[]>
created_at              TIMESTAMP NOT NULL, DEFAULT NOW()
updated_at              TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `cma_report_templates`
```
id                      VARCHAR  PK, DEFAULT gen_random_uuid()
user_id                 VARCHAR  NOT NULL, FK → users.id (CASCADE)
name                    TEXT     NOT NULL
is_default              BOOLEAN  DEFAULT false
included_sections       JSON     -- string[]
section_order           JSON     -- string[]
cover_letter_override   TEXT
layout                  TEXT     DEFAULT 'two_photos'
theme                   TEXT     DEFAULT 'spyglass'
photo_layout            TEXT     DEFAULT 'first_dozen'
map_style               TEXT     DEFAULT 'streets'
show_map_polygon        BOOLEAN  DEFAULT true
include_agent_footer    BOOLEAN  DEFAULT true
cover_page_config       JSON     -- CoverPageConfig type
created_at              TIMESTAMP NOT NULL, DEFAULT NOW()
updated_at              TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `seller_updates`
```
id                 VARCHAR  PK, DEFAULT gen_random_uuid()
user_id            VARCHAR  FK → users.id (SET NULL)
name               TEXT     NOT NULL  -- property address
email              TEXT     NOT NULL
postal_code        TEXT
city               TEXT
subdivision        TEXT
elementary_school  TEXT
middle_school      TEXT
high_school        TEXT
property_sub_type  TEXT
min_beds           TEXT
max_beds           TEXT
min_baths          TEXT
max_baths          TEXT
min_sqft           TEXT
max_sqft           TEXT
min_price          TEXT
max_price          TEXT
min_year_built     TEXT
max_year_built     TEXT
sold_days          TEXT
email_frequency    TEXT     NOT NULL  -- 'weekly'|'bimonthly'|'quarterly'
last_sent_at       TIMESTAMP
next_send_at       TIMESTAMP
is_active          BOOLEAN  NOT NULL, DEFAULT true
created_at         TIMESTAMP NOT NULL, DEFAULT NOW()
updated_at         TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `seller_update_send_history`
```
id                   VARCHAR  PK, DEFAULT gen_random_uuid()
seller_update_id     VARCHAR  NOT NULL, FK → seller_updates.id (CASCADE)
sent_at              TIMESTAMP NOT NULL, DEFAULT NOW()
recipient_email      TEXT     NOT NULL
status               TEXT     NOT NULL  -- 'success'|'failed'|'bounced'
property_count       INTEGER  DEFAULT 0
error_message        TEXT
sendgrid_message_id  TEXT
```

#### `admin_activity_logs`
```
id              SERIAL   PK
admin_user_id   VARCHAR  FK → users.id (SET NULL)
action          VARCHAR(100) NOT NULL
target_user_id  VARCHAR  FK → users.id (SET NULL)
previous_value  TEXT
new_value       TEXT
details         JSONB
ip_address      VARCHAR(45)
user_agent      TEXT
created_at      TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `saved_searches`
```
id          VARCHAR  PK, DEFAULT gen_random_uuid()
user_id     VARCHAR  -- optional
name        TEXT     NOT NULL
criteria    JSON     NOT NULL
created_at  TIMESTAMP NOT NULL, DEFAULT NOW()
updated_at  TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `display_preferences`
```
id                      VARCHAR  PK, DEFAULT gen_random_uuid()
price_format            TEXT     NOT NULL, DEFAULT 'commas'
area_unit               TEXT     NOT NULL, DEFAULT 'sqft'
date_format             TEXT     NOT NULL, DEFAULT 'MM/DD/YYYY'
include_agent_branding  BOOLEAN  NOT NULL, DEFAULT true
include_market_stats    BOOLEAN  NOT NULL, DEFAULT true
updated_at              TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `lead_gate_settings`
```
id                     VARCHAR  PK, DEFAULT gen_random_uuid()
enabled                BOOLEAN  NOT NULL, DEFAULT false
free_views_allowed     INTEGER  NOT NULL, DEFAULT 3
count_property_details BOOLEAN  NOT NULL, DEFAULT true
count_list_views       BOOLEAN  NOT NULL, DEFAULT false
updated_at             TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `wp_favorites`
```
id           VARCHAR  PK, DEFAULT gen_random_uuid()
wp_user_id   TEXT     NOT NULL
property_id  TEXT     NOT NULL
created_at   TIMESTAMP NOT NULL, DEFAULT NOW()
```

#### `neighborhood_boundaries`
```
id                VARCHAR  PK, DEFAULT gen_random_uuid()
name              TEXT     NOT NULL
city              TEXT
area              TEXT
boundary          JSON     -- number[][][] (GeoJSON polygon coordinates)
center_latitude   DECIMAL(10,7)
center_longitude  DECIMAL(10,7)
fetched_at        TIMESTAMP NOT NULL, DEFAULT NOW()
expires_at        TIMESTAMP
```

#### `sync_metadata`
```
id                  VARCHAR  PK, DEFAULT gen_random_uuid()
sync_type           TEXT     NOT NULL, UNIQUE  -- 'properties' or 'media'
last_sync_timestamp TIMESTAMP
last_sync_status    TEXT     -- 'success'|'error'|'in_progress'
last_sync_message   TEXT
properties_synced   INTEGER  DEFAULT 0
media_synced        INTEGER  DEFAULT 0
updated_at          TIMESTAMP NOT NULL, DEFAULT NOW()
```

---

## 3. API ENDPOINTS

### Authentication

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/auth/google` | No | — | Initiate Google OAuth (redirect flow) |
| GET | `/auth/google/popup` | No | — | Initiate Google OAuth (popup flow for iframe) |
| GET | `/auth/google/callback` | No | — | Google OAuth callback handler |
| POST | `/auth/logout` | No | — | Destroy session |
| POST | `/api/auth/register` | No | — | Local registration (email/password) |
| POST | `/api/auth/login` | No | — | Local login |
| GET | `/api/auth/me` | Yes | — | Get current user |

### Property Search

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/search` | No | — | Unified search (routes to Repliers for active, DB for closed) |
| GET | `/api/properties/search` | No | — | Database-only search with full filter support |
| GET | `/api/properties/count` | No | — | Total property count in DB |
| POST | `/api/properties/search/polygon` | No | — | Search within map boundary polygon |
| GET | `/api/properties/types` | No | — | Available property types |
| GET | `/api/properties/:id` | No | — | Single property by ID |
| GET | `/api/properties` | No | — | List all properties |
| GET | `/api/properties/inventory` | No | — | Unified inventory counts |
| GET | `/api/properties/inventory/debug` | Yes | — | Debug inventory data |
| GET | `/api/inventory/summary` | No | — | Inventory summary stats |
| GET | `/api/inventory/audit` | No | — | Inventory audit data |

### Repliers API (MLS)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/repliers/listings` | No | — | Search Repliers MLS listings |
| GET | `/api/repliers/listings/:mlsNumber` | No | — | Get single listing by MLS number |
| GET | `/api/repliers/listings/:mlsNumber/photo-insights` | No | — | AI photo insights for listing |
| GET | `/api/repliers/locations` | No | — | Location autocomplete |
| POST | `/api/repliers/nlp` | Yes | — | Natural language property search |
| POST | `/api/repliers/image-search` | Yes | — | AI visual similarity search |

### CMA Management

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/cmas` | Yes | — | List user's CMAs |
| GET | `/api/cmas/:id` | Yes | — | Get single CMA |
| POST | `/api/cmas` | Yes | — | Create new CMA |
| PUT | `/api/cmas/:id` | Yes | — | Full update CMA |
| PATCH | `/api/cmas/:id` | Yes | — | Partial update CMA |
| DELETE | `/api/cmas/:id` | Yes | — | Delete CMA |
| POST | `/api/cmas/:id/share` | Yes | — | Generate public share link |
| DELETE | `/api/cmas/:id/share` | Yes | — | Revoke share link |
| POST | `/api/cmas/:id/email-share` | Yes | — | Email CMA share link |
| GET | `/api/share/cma/:token` | No | — | Access shared CMA (public) |
| GET | `/api/cmas/:id/statistics` | Yes | — | CMA comparable statistics |
| GET | `/api/cmas/:id/timeline` | Yes | — | CMA timeline data |
| GET | `/api/cma/report-sections` | Yes | — | Available report sections |
| PUT | `/api/cmas/:id/adjustments` | Yes | — | Save property adjustments |
| GET | `/api/cmas/:id/adjustments` | Yes | — | Get property adjustments |
| POST | `/api/cmas/:id/brochure` | Yes | — | Upload listing brochure |
| DELETE | `/api/cmas/:id/brochure` | Yes | — | Delete listing brochure |
| GET | `/api/cmas/:id/brochure` | Yes | — | Get brochure data |
| POST | `/api/cma/draft` | Yes | — | Create CMA draft from AI criteria |

### AI Features

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/chat` | No | — | AI Chat Assistant interaction |
| GET | `/api/chat/status` | No | — | Check AI configuration status |
| POST | `/api/ai/generate-cover-letter` | Yes | — | AI generate CMA cover letter |
| POST | `/api/ai/generate-default-cover-letter` | Yes | — | Generate default cover letter template |
| POST | `/api/ai/sanitize-repliers-nlp` | Yes | — | Sanitize NLP search output |

### Seller Updates

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/seller-updates` | Yes | — | List user's seller updates |
| GET | `/api/seller-updates/:id` | Yes | — | Get single seller update |
| POST | `/api/seller-updates` | Yes | — | Create seller update |
| PATCH | `/api/seller-updates/:id` | Yes | — | Update seller update |
| DELETE | `/api/seller-updates/:id` | Yes | — | Delete seller update |
| GET | `/api/seller-updates/:id/preview` | Yes | — | Preview email content |
| POST | `/api/seller-updates/:id/send-test` | Yes | — | Send test email |
| POST | `/api/seller-updates/:id/toggle-active` | Yes | — | Toggle active status |
| GET | `/api/seller-updates/:id/history` | Yes | — | Get send history |

### Dashboard & Analytics

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/stats/dashboard` | No | — | Dashboard statistics |
| GET | `/api/stats/listings-by-month` | No | — | Monthly listing trends |
| GET | `/api/stats/price-distribution` | No | — | Price distribution data |
| GET | `/api/stats/cmas-by-month` | Yes | — | CMA creation trends |
| GET | `/api/dashboard/system-status` | No | — | System integration status |
| GET | `/api/dashboard/active-properties` | No | — | Recent active listings |
| GET | `/api/dashboard/recent-sold` | No | — | Recent sold properties |
| GET | `/api/dashboard/dom-analytics` | No | — | Days on market analytics |

### Follow Up Boss Integration

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/fub/calendar` | Yes | — | FUB calendar events |
| GET | `/api/fub/leads` | Yes | — | FUB leads |
| GET | `/api/fub/user-id` | Yes | — | Current user's FUB ID |
| GET | `/api/fub/status` | Yes | — | FUB configuration status |
| GET | `/api/admin/fub/users` | Yes | Admin | All FUB users |

### ReZen (Mission Control) Integration

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/rezen/production` | Yes | — | Agent production data |
| GET | `/api/rezen/status` | Yes | — | ReZen configuration status |
| GET | `/api/rezen/reports/agent-production` | Yes | — | Agent production report |

### Admin Routes

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/admin/users` | Yes | Super Admin | List all users |
| PUT | `/api/admin/users/:id/role` | Yes | Super Admin | Change user role |
| PUT | `/api/admin/users/:id/status` | Yes | Super Admin | Enable/disable user |
| DELETE | `/api/admin/users/:id` | Yes | Super Admin | Delete user permanently |
| GET | `/api/admin/activity-logs` | Yes | Super Admin | Admin activity audit log |
| GET | `/api/admin/company-settings` | Yes | — | Company settings |
| PUT | `/api/admin/company-settings` | Yes | Admin | Update company settings |
| GET | `/api/admin/custom-pages` | Yes | — | Custom report pages |
| POST | `/api/admin/custom-pages` | Yes | Admin | Create custom page |
| PUT | `/api/admin/custom-pages/:id` | Yes | Admin | Update custom page |
| DELETE | `/api/admin/custom-pages/:id` | Yes | Admin | Delete custom page |
| POST | `/api/admin/repliers/sync` | Yes | — | Trigger manual Repliers sync |
| GET | `/api/admin/repliers/sync/status` | Yes | — | Repliers sync status |

### Autocomplete

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/autocomplete/cities` | No | — | City autocomplete |
| GET | `/api/autocomplete/subdivisions` | No | — | Subdivision autocomplete |
| GET | `/api/autocomplete/postalCodes` | No | — | Postal code autocomplete |
| GET | `/api/autocomplete/elementarySchools` | No | — | Elementary school autocomplete |
| GET | `/api/autocomplete/middleSchools` | No | — | Middle school autocomplete |
| GET | `/api/autocomplete/highSchools` | No | — | High school autocomplete |
| GET | `/api/autocomplete/schoolDistricts` | No | — | School district autocomplete |
| GET | `/api/autocomplete/neighborhoods` | No | — | Neighborhood autocomplete |

### Map Layers

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/map-layers/flood-zones` | No | — | FEMA flood zone data |
| GET | `/api/map-layers/school-districts` | No | — | School district boundaries |
| GET | `/api/map-layers/available` | No | — | List available map layers |

### Neighborhoods

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/neighborhoods/review` | No | — | Neighborhood reviews |
| GET | `/api/neighborhoods/by-coordinates` | No | — | Lookup by lat/lng |
| GET | `/api/neighborhoods/search` | No | — | Search neighborhoods |
| GET | `/api/neighborhoods/city/:city` | No | — | Neighborhoods by city |
| GET | `/api/neighborhoods/geojson` | No | — | GeoJSON boundaries |
| GET | `/api/neighborhoods/match-mls` | No | — | Match MLS subdivision |

### Lead Gate

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/lead-gate/settings` | No | — | Get lead gate config |
| PUT | `/api/lead-gate/settings` | Yes | — | Update lead gate config |
| POST | `/api/lead-gate/track-view` | No | — | Track property view (cookie-based) |
| GET | `/api/lead-gate/status` | No | — | Current view status |

### Display Preferences

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/display-preferences` | No | — | Get display settings |
| PUT | `/api/display-preferences` | Yes | — | Update display settings |

### Geocoding

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/geocode` | Yes | — | Geocode single address |
| POST | `/api/geocode/batch` | Yes | — | Batch geocode addresses |

### WordPress Integration

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/widget/search` | No | — | Widget property search |
| GET | `/api/widget/property/:id` | No | — | Widget single property |
| POST | `/api/wordpress/favorites` | No | — | Add WP favorite |
| DELETE | `/api/wordpress/favorites` | No | — | Remove WP favorite |
| GET | `/api/wordpress/favorites/:userId` | No | — | Get user favorites |

### Object Storage (Replit-specific)

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/uploads/request-url` | Yes | — | Get signed upload URL |
| GET | `/objects/:objectPath(*)` | No | — | Serve stored object |

### Health & Sync

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/health` | No | — | Health check with DB connectivity |
| POST | `/api/sync` | Yes | — | Trigger MLS Grid manual sync |
| GET | `/api/sync/status` | No | — | MLS Grid sync status |

---

## 4. PROJECT STRUCTURE

```
/
├── client/                          # Frontend React app (Vite)
│   ├── src/
│   │   ├── App.tsx                  # Root component, routing, layout
│   │   ├── main.tsx                 # Entry point
│   │   ├── index.css                # Global styles, Tailwind config
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx        # Main dashboard with stats, charts
│   │   │   ├── Properties.tsx       # Property search & browse
│   │   │   ├── PropertyDetailPage.tsx # Individual property detail
│   │   │   ├── BuyerSearch.tsx      # AI-powered buyer search
│   │   │   ├── CMAs.tsx             # CMA list page
│   │   │   ├── CMANew.tsx           # Create new CMA
│   │   │   ├── CMADetailPage.tsx    # CMA detail with comparables
│   │   │   ├── CMAPresentationBuilder.tsx # CMA presentation editor
│   │   │   ├── SharedCMAView.tsx    # Public shared CMA view
│   │   │   ├── SellerUpdates.tsx    # Seller update list
│   │   │   ├── SellerUpdateNew.tsx  # Create/edit seller update
│   │   │   ├── SellerUpdatePreview.tsx # Preview seller update email
│   │   │   ├── SellerUpdateEmbed.tsx # Embeddable seller update form
│   │   │   ├── CalendarPage.tsx     # FUB calendar integration
│   │   │   ├── LeadsPage.tsx        # FUB leads management
│   │   │   ├── Clients.tsx          # Client management
│   │   │   ├── MissionControl.tsx   # ReZen production reporting
│   │   │   ├── Analytics.tsx        # Market analytics
│   │   │   ├── Settings.tsx         # Agent settings, API sync, display prefs
│   │   │   ├── AdminPage.tsx        # Admin: company settings, custom pages
│   │   │   ├── UserManagement.tsx   # Admin: user roles, enable/disable
│   │   │   ├── ActivityLogs.tsx     # Admin: audit log
│   │   │   ├── InventoryAudit.tsx   # Dev: inventory data audit
│   │   │   ├── EmbedCodeGenerator.tsx # Generate iframe embed codes
│   │   │   ├── Login.tsx            # Login page (Google OAuth)
│   │   │   └── not-found.tsx        # 404 page
│   │   ├── components/
│   │   │   ├── AppSidebar.tsx       # Main sidebar navigation
│   │   │   ├── ChatAssistant.tsx    # AI chat assistant (floating)
│   │   │   ├── SearchCriteria.tsx   # Property search form
│   │   │   ├── PropertyCard.tsx     # Property card display
│   │   │   ├── PropertyDetail.tsx   # Full property detail component
│   │   │   ├── PropertyResults.tsx  # Search results container
│   │   │   ├── PropertyTable.tsx    # Tabular property listing
│   │   │   ├── PropertyListCard.tsx # Compact property card
│   │   │   ├── PropertyMapView.tsx  # Map-based property view
│   │   │   ├── PolygonMapSearch.tsx # Draw polygon to search
│   │   │   ├── CMABuilder.tsx       # CMA creation workflow
│   │   │   ├── CMAReport.tsx        # CMA report rendering
│   │   │   ├── CMAPdfDocument.tsx   # PDF export component
│   │   │   ├── AdjustmentsSection.tsx # CMA property adjustments
│   │   │   ├── NeighborhoodReview.tsx # Neighborhood info display
│   │   │   ├── MapLayersControl.tsx # Toggle flood/school layers
│   │   │   ├── StatusFilterTabs.tsx # Property status filter tabs
│   │   │   ├── ProtectedRoute.tsx   # Auth route guard
│   │   │   ├── UserMenu.tsx         # User avatar/menu dropdown
│   │   │   ├── ThemeToggle.tsx      # Dark/light mode toggle
│   │   │   ├── LeadGateModal.tsx    # Registration wall modal
│   │   │   ├── ObjectUploader.tsx   # File upload component
│   │   │   ├── VisualMatchPanel.tsx # AI visual match results
│   │   │   ├── ListingBrochureContent.tsx # Brochure display
│   │   │   ├── MarketingInsightsCarousel.tsx # Market insights
│   │   │   ├── presentation/       # CMA presentation sub-components
│   │   │   │   ├── CoverLetterEditor.tsx
│   │   │   │   ├── CoverPageEditor.tsx
│   │   │   │   ├── PhotoSelectionModal.tsx
│   │   │   │   ├── MapboxCMAMap.tsx
│   │   │   │   ├── SaveAsTemplateModal.tsx
│   │   │   │   ├── LoadTemplateDropdown.tsx
│   │   │   │   └── ExpandableList.tsx
│   │   │   ├── cma/                 # CMA detail sub-components
│   │   │   │   ├── CMAExportDropdown.tsx
│   │   │   │   ├── CMAMapView.tsx
│   │   │   │   ├── CMAShareDropdown.tsx
│   │   │   │   ├── CMAStatsView.tsx
│   │   │   │   └── PropertyDetailModal.tsx
│   │   │   ├── shared/
│   │   │   │   └── MapboxMap.tsx     # Reusable Mapbox map
│   │   │   ├── maps/
│   │   │   │   └── MapLegend.tsx
│   │   │   ├── admin/
│   │   │   │   └── FUBUserSearch.tsx
│   │   │   └── ui/                  # shadcn/ui components (50+ files)
│   │   ├── contexts/
│   │   │   ├── ThemeContext.tsx      # Dark/light mode state
│   │   │   ├── ChatContext.tsx       # AI chat state
│   │   │   ├── LeadGateContext.tsx   # Lead gate tracking
│   │   │   └── SelectedPropertyContext.tsx
│   │   ├── hooks/
│   │   │   ├── use-permissions.ts   # Role/permission checks
│   │   │   ├── use-lead-gate.ts     # Lead gate hook
│   │   │   ├── use-upload.ts        # File upload hook
│   │   │   ├── use-toast.ts         # Toast notifications
│   │   │   └── use-mobile.tsx       # Mobile detection
│   │   └── lib/
│   │       ├── queryClient.ts       # TanStack Query config
│   │       ├── api.ts               # API helper functions
│   │       ├── utils.ts             # General utilities
│   │       ├── formatters.ts        # Price/date formatting
│   │       ├── statusColors.ts      # Property status color system
│   │       ├── mapColors.ts         # Map color utilities
│   │       ├── iframe.ts            # Iframe detection & popup auth
│   │       ├── adjustmentCalculations.ts # CMA adjustment math
│   │       ├── cma-data-utils.ts    # CMA data helpers
│   │       ├── photoNormalizer.ts   # Normalize photo URLs
│   │       ├── property-type-utils.ts # Property type helpers
│   │       └── pdfStyles.ts         # PDF styling config
│   └── public/                      # Static assets
│
├── server/                          # Backend Express API
│   ├── index.ts                     # Server entry, middleware, startup
│   ├── routes.ts                    # All API route definitions (~8200 lines)
│   ├── auth.ts                      # Passport.js Google OAuth + local auth
│   ├── storage.ts                   # Database storage layer (IStorage interface)
│   ├── config.ts                    # Zod env validation
│   ├── logger.ts                    # Structured JSON logging
│   ├── seed-data.ts                 # Development seed data
│   ├── vite.ts                      # Vite dev server integration
│   ├── repliers-client.ts           # Repliers MLS API client (retry, rate limiting)
│   ├── repliers-sync.ts            # Scheduled Repliers data sync
│   ├── mlsgrid-client.ts           # MLS Grid API client
│   ├── mlsgrid-sync.ts             # MLS Grid data sync
│   ├── openai-client.ts            # OpenAI GPT-4o integration
│   ├── followupboss-service.ts     # Follow Up Boss API
│   ├── homereview-client.ts        # HomeReview property API
│   ├── mapbox-geocoding.ts         # Mapbox geocoding service
│   ├── resend-service.ts           # Resend email service
│   ├── email-scheduler.ts          # Automated email scheduling
│   ├── email-templates.ts          # HTML email templates
│   ├── seller-update-service.ts    # Seller update business logic
│   ├── seller-update-scheduler.ts  # Seller update cron scheduling
│   ├── inventory-service.ts        # Unified inventory aggregation
│   ├── neighborhood-service.ts     # Neighborhood data service
│   ├── admin-activity-service.ts   # Admin audit logging
│   ├── external-api.ts             # External API fetch utilities
│   ├── user-utils.ts               # User utility functions
│   ├── wordpress-routes.ts         # WordPress widget endpoints
│   ├── widget-routes.ts            # Embeddable widget endpoints
│   ├── data/listings/
│   │   ├── index.ts                # Listing data exports
│   │   ├── canonical-listing-service.ts # Unified listing service
│   │   └── repliers-mapper.ts      # Map Repliers → canonical format
│   └── replit_integrations/
│       └── object_storage/         # Replit Object Storage (replace for Lovable)
│           ├── index.ts
│           ├── routes.ts
│           ├── objectStorage.ts
│           └── objectAcl.ts
│
├── shared/                          # Shared between frontend & backend
│   ├── schema.ts                    # Drizzle ORM schema + Zod validators
│   ├── permissions.ts               # Role hierarchy + permission system
│   ├── propertyTypeGuard.ts         # Property type filtering logic
│   └── repliers-helpers.ts          # Shared Repliers utilities
│
├── migrations/                      # Drizzle migration files
├── drizzle.config.ts               # Drizzle Kit configuration
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript config
├── vite.config.ts                   # Vite build config
├── tailwind.config.ts              # Tailwind CSS config
└── index.html                       # HTML entry point
```

---

## 5. EXTERNAL INTEGRATIONS

### Repliers API (Primary MLS Data Source)
- **Base URL**: `https://api.repliers.io`
- **Authentication**: API key in `REPLIERS_API_KEY` env var, sent as `REPLIERS-API-KEY` header
- **Key Endpoints Used**:
  - `GET /listings` — Search listings with extensive filter support
  - `GET /listings/{mlsNumber}` — Single listing detail
  - `GET /locations` — Location autocomplete
- **Rate Limits**: Built-in retry with exponential backoff for 429/503 responses (3 retries, 1s initial delay)
- **Timeout**: 30 seconds (Axios)
- **Features**: Active/pending/closed listings, photos, property details, neighborhood boundaries

### MLS Grid API
- **Base URL**: Configured via `MLSGRID_API_URL` env var
- **Authentication**: Bearer token via `MLS_GRID_BBO` or `MLS_GRID_VOW` env vars
- **Key Endpoints Used**:
  - Property data sync (daily scheduled)
  - Media resource sync
- **Rate Limits**: Client-side rate limiting (per-second and per-hour counters)
- **Timeout**: 30 seconds (Axios)

### Follow Up Boss (FUB)
- **Base URL**: `https://api.followupboss.com/v1`
- **Authentication**: HTTP Basic Auth with `FUB_API_KEY` as username (password empty)
- **Key Endpoints Used**:
  - `GET /users` — Team users
  - `GET /events` — Calendar events
  - `GET /people` — Leads/contacts
- **Note**: No retry logic, no explicit timeout

### Google OAuth 2.0
- **Provider**: Google Identity Platform
- **Flow**: Authorization Code (redirect-based + popup for iframe embedding)
- **Scopes**: `email`, `profile`
- **Callback URL**: `{domain}/auth/google/callback`
- **Domain Restriction**: Only `@spyglassrealty.com` emails allowed (configurable via `ALLOWED_EMAIL_DOMAIN`)
- **Override Emails**: Additional allowed emails via `ALLOWED_EMAILS` comma-separated list

### Mapbox
- **Features Used**:
  - Interactive maps (property search, CMA, detail pages)
  - Geocoding API (address → coordinates)
  - Map styles (streets, satellite, dark)
  - Flood zone & school district overlay layers
- **Token Types**:
  - `MAPBOX_ACCESS_TOKEN` — Server-side (geocoding)
  - `VITE_MAPBOX_TOKEN` — Client-side (map rendering, public token)
- **Libraries**: `mapbox-gl`, `react-map-gl`

### OpenAI
- **Features Used**:
  - Conversational property search assistant (chat)
  - CMA intake assistant (natural language → search criteria)
  - Cover letter generation for CMA presentations
  - NLP search query processing
  - Visual similarity ranking for property photos
- **Model**: GPT-4o
- **Library**: `openai` npm package

### Resend (Email)
- **Purpose**: Sending seller update market report emails
- **Authentication**: `RESEND_API_KEY`
- **Library**: `resend` npm package

### ReZen (Mission Control)
- **Purpose**: Agent production volume reporting
- **Authentication**: `REZEN_API_KEY`
- **Endpoints**: Production data, agent reports

### FEMA NFHL API
- **Purpose**: National Flood Hazard Layer data for map overlays
- **Authentication**: None (public API)

### City of Austin ArcGIS
- **Purpose**: School district boundary data for map overlays
- **Authentication**: None (public API)

### Replit Object Storage
- **Purpose**: CMA listing brochure file uploads
- **Note**: Uses Google Cloud Storage via Replit sidecar. **Must be replaced** with Supabase Storage, AWS S3, or similar on Lovable/Vercel.

---

## 6. AUTHENTICATION FLOW

### Login Process
1. User visits `/login` page
2. Clicks "Continue with Google" button
3. **Direct access**: Redirects to `/auth/google` → Google consent screen → callback
4. **Iframe/embedded**: Opens popup window to `/auth/google/popup` → Google consent → callback sends `postMessage` to parent → popup closes
5. Server validates Google profile email against `ALLOWED_EMAIL_DOMAIN` (default: `spyglassrealty.com`) and `ALLOWED_EMAILS` list
6. If authorized: creates/updates user in DB, establishes session
7. If denied: redirects to `/login?error=access_denied`

### Session Management
- **Library**: `express-session` with `connect-pg-simple` (PostgreSQL session store)
- **Cookie**: `connect.sid`, HTTP-only, secure in production, SameSite=none for iframe support
- **Max Age**: 7 days
- **Storage**: PostgreSQL `session` table (auto-created by connect-pg-simple)

### Role-Based Access Control
4-tier hierarchy (lowest → highest):
1. **Agent** — Create/edit own CMAs, presentations, view analytics
2. **Admin** — All agent permissions + company settings, display preferences, templates
3. **Super Admin** — All admin permissions + user management (roles, enable/disable, delete)
4. **Developer** — All permissions + debug tools, manage super admins

**Hardcoded role assignments** (in `shared/permissions.ts`):
- Developer emails: `daryl@spyglassrealty.com`, `ryan@spyglassrealty.com`
- Initial Super Admin: `caleb@spyglassrealty.com`
- All other `@spyglassrealty.com` users default to `agent`

**Permission checks**:
- `requireAuth` — Session must exist
- `requireMinimumRole(role)` — User role ≥ required role in hierarchy
- `requirePermission(permission)` — User role has specific permission

### Protected Routes
- Frontend: `<ProtectedRoute>` component checks `/api/auth/me`, redirects to `/login` on 401
- Backend: `requireAuth` middleware returns 401 JSON for unauthenticated requests
- Public routes: Property search, shared CMA views, health check, widgets

---

## 7. KEY FEATURES

### Property Search (IDX)
- **Components**: `Properties.tsx`, `SearchCriteria.tsx`, `PropertyResults.tsx`, `PropertyCard.tsx`, `PropertyMapView.tsx`, `PropertyTable.tsx`, `PropertyListCard.tsx`, `StatusFilterTabs.tsx`, `PolygonMapSearch.tsx`, `MapLayersControl.tsx`
- **API Endpoints**: `GET /api/search`, `GET /api/repliers/listings`, `GET /api/properties/search`, `POST /api/properties/search/polygon`, `GET /api/autocomplete/*`
- **DB Tables**: `properties`, `media`, `neighborhood_boundaries`
- **Key Logic**: Unified search routes active/under_contract to Repliers API, closed/sold to local PostgreSQL. Includes rental filtering, school filtering, polygon search.

### CMA Builder
- **Components**: `CMAs.tsx`, `CMANew.tsx`, `CMADetailPage.tsx`, `CMABuilder.tsx`, `AdjustmentsSection.tsx`, `CMAStatsView.tsx`, `CMAMapView.tsx`, `PropertyDetailModal.tsx`, `CMAShareDropdown.tsx`, `CMAExportDropdown.tsx`
- **API Endpoints**: All `/api/cmas/*` routes, `/api/ai/generate-cover-letter`, `/api/cma/draft`
- **DB Tables**: `cmas`, `cma_report_configs`
- **Key Logic**: Two-query strategy (active + closed), property adjustments (sqft, beds, baths, pool, garage, year, lot), AI cover letter generation, shareable links with expiration.

### Presentation Builder
- **Components**: `CMAPresentationBuilder.tsx`, `CoverLetterEditor.tsx`, `CoverPageEditor.tsx`, `PhotoSelectionModal.tsx`, `MapboxCMAMap.tsx`, `SaveAsTemplateModal.tsx`, `LoadTemplateDropdown.tsx`, `CMAPdfDocument.tsx`, `CMAReport.tsx`, `ListingBrochureContent.tsx`
- **API Endpoints**: `/api/cmas/:id`, CMA report config routes
- **DB Tables**: `cma_report_configs`, `cma_report_templates`
- **Key Logic**: Customizable sections, photo layout options (first dozen, all, AI-suggested, custom), Mapbox map with polygon overlay, PDF export via `@react-pdf/renderer`, save/load templates.

### Calendar Integration (FUB)
- **Components**: `CalendarPage.tsx`
- **API Endpoints**: `GET /api/fub/calendar`, `GET /api/fub/user-id`
- **Key Logic**: Fetches events from Follow Up Boss API, displays in calendar view. Role-based: agents see own events, admins see team events.

### Leads Management (FUB)
- **Components**: `LeadsPage.tsx`
- **API Endpoints**: `GET /api/fub/leads`, `GET /api/fub/status`
- **Key Logic**: Lists leads from Follow Up Boss. Role-based data access.

### User Management
- **Components**: `UserManagement.tsx`, `ActivityLogs.tsx`
- **API Endpoints**: `GET /api/admin/users`, `PUT /api/admin/users/:id/role`, `PUT /api/admin/users/:id/status`, `DELETE /api/admin/users/:id`, `GET /api/admin/activity-logs`
- **DB Tables**: `users`, `admin_activity_logs`
- **Key Logic**: Super Admin only. Role changes, enable/disable, permanent delete. All actions logged to audit trail.

### Admin Dashboard
- **Components**: `AdminPage.tsx`
- **API Endpoints**: `GET/PUT /api/admin/company-settings`, CRUD `/api/admin/custom-pages`
- **Key Logic**: Company branding settings, custom report page management.

### Seller Updates
- **Components**: `SellerUpdates.tsx`, `SellerUpdateNew.tsx`, `SellerUpdatePreview.tsx`, `SellerUpdateEmbed.tsx`
- **API Endpoints**: All `/api/seller-updates/*` routes
- **DB Tables**: `seller_updates`, `seller_update_send_history`
- **Key Logic**: Automated market update emails. Configurable criteria (location, property specs). Scheduled via `node-cron` (daily at 9 AM Central). Email via Resend. Frequency: weekly/bimonthly/quarterly.

### AI Chat Assistant
- **Components**: `ChatAssistant.tsx` (floating panel), `ChatContext.tsx`
- **API Endpoints**: `POST /api/chat`, `GET /api/chat/status`
- **Key Logic**: Conversational assistant with intent detection (IDX_SEARCH, CMA_INTAKE, OTHER). Extracts search criteria from natural language, can initiate CMA drafts.

### Buyer Search (AI-Powered)
- **Components**: `BuyerSearch.tsx`
- **API Endpoints**: `POST /api/repliers/nlp`, `POST /api/repliers/image-search`
- **Key Logic**: Natural language property search, AI visual similarity ranking.

---

## 8. BUILD AND RUN COMMANDS

```bash
npm install          # Install all dependencies
npm run dev          # Start development server (Express + Vite HMR)
npm run build        # Build for production (Vite frontend + esbuild backend)
npm run start        # Start production server
npm run check        # TypeScript type checking
npm run db:push      # Push Drizzle schema to database (creates/migrates tables)
```

### Production Build Output
- Frontend: `dist/public/` (Vite build)
- Backend: `dist/index.js` (esbuild bundle, ESM format)

### Development Server
- Port: 5000 (Express serves both API and Vite dev server)
- Vite HMR enabled for frontend
- Backend auto-restarts on file changes via `tsx`

---

## 9. DEPENDENCIES

### Backend Core
| Package | Purpose |
|---------|---------|
| `express` | HTTP server framework |
| `express-session` | Session management |
| `connect-pg-simple` | PostgreSQL session store |
| `passport` | Authentication framework |
| `passport-google-oauth20` | Google OAuth strategy |
| `passport-local` | Local auth strategy |
| `bcryptjs` | Password hashing |
| `cookie-parser` | Cookie parsing middleware |
| `express-rate-limit` | API rate limiting |
| `drizzle-orm` | Database ORM |
| `drizzle-zod` | Zod schema generation from Drizzle |
| `@neondatabase/serverless` | Neon PostgreSQL driver |
| `zod` | Runtime validation |
| `axios` | HTTP client (Repliers, MLS Grid, HomeReview) |
| `openai` | OpenAI API client |
| `resend` | Email delivery service |
| `node-cron` | Scheduled task execution |
| `uuid` | UUID generation |
| `ws` | WebSocket support |

### Frontend Core
| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI framework |
| `wouter` | Client-side routing |
| `@tanstack/react-query` | Server state management + caching |
| `react-hook-form` | Form management |
| `@hookform/resolvers` | Zod resolver for forms |
| `mapbox-gl` / `react-map-gl` | Interactive maps |
| `recharts` | Charts and data visualization |
| `@react-pdf/renderer` | PDF generation |
| `framer-motion` | Animations |
| `date-fns` | Date formatting |
| `@turf/turf` | Geospatial calculations |
| `cmdk` | Command palette |
| `lucide-react` | Icons |
| `react-icons` | Additional icon sets |
| `embla-carousel-react` | Carousel component |
| `react-resizable-panels` | Resizable panel layouts |
| `vaul` | Drawer component |

### UI Library (shadcn/ui)
| Package | Purpose |
|---------|---------|
| `@radix-ui/react-*` (20+ packages) | Accessible UI primitives |
| `class-variance-authority` | Component variant management |
| `clsx` / `tailwind-merge` | Class name utilities |
| `tailwindcss-animate` / `tw-animate-css` | Animation utilities |

### File Upload
| Package | Purpose |
|---------|---------|
| `@uppy/core` / `@uppy/react` / `@uppy/dashboard` / `@uppy/aws-s3` | File upload UI |
| `@google-cloud/storage` | Replit Object Storage (GCS backend) |

### Build Tools
| Package | Purpose |
|---------|---------|
| `vite` | Frontend build tool |
| `@vitejs/plugin-react` | React Vite plugin |
| `esbuild` | Backend bundler |
| `tsx` | TypeScript execution (dev) |
| `typescript` | Type checking |
| `drizzle-kit` | Database migration tool |
| `tailwindcss` / `postcss` / `autoprefixer` | CSS toolchain |

---

## 10. KNOWN ISSUES / TECHNICAL DEBT

### Bugs / Issues
1. **Rate limiter trust proxy warning**: The `express-rate-limit` library logs `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` warnings — cosmetic only, doesn't affect functionality.
2. **PostCSS warning**: "A PostCSS plugin did not pass the `from` option" — cosmetic, doesn't affect builds.

### Partially Implemented
1. **Leaflet maps still referenced**: Both Leaflet and Mapbox are in dependencies. Mapbox is the standard; some legacy Leaflet references may remain.
2. **HomeReview API**: Referenced but the external service URL points to another Replit app — may need reconfiguration.
3. **MLS Grid sync**: Configured but closed listing data primarily comes from Repliers API in practice.

### Technical Debt
1. **`server/routes.ts` is ~8,200 lines**: Should be split into route modules (properties, cmas, admin, etc.).
2. **Mixed API patterns**: Some routes use Repliers directly, some use HomeReview, some use local DB — the canonical listing service partially unifies this but isn't used everywhere.
3. **Hardcoded role emails**: Developer and Super Admin emails are hardcoded in `shared/permissions.ts`. Should be moved to DB or env vars.
4. **No automated tests**: No unit or integration test suite exists.
5. **Session management**: Uses PostgreSQL session store (`connect-pg-simple`) which creates a `session` table. This works well but the session cleanup (expired sessions) relies on the library's default behavior.
6. **Follow Up Boss / Resend**: No timeout or retry logic on `fetch` calls to these services.

### Security Improvements Needed
1. **CSRF protection**: No CSRF tokens implemented (relies on SameSite cookies).
2. **API rate limiting**: Currently applies to all `/api/*` routes uniformly. Could benefit from per-endpoint rate limits.
3. **Input validation**: Most routes validate with Zod, but some older routes have manual validation.

### Migration-Specific Concerns
1. **Replit Object Storage**: Used for CMA brochure uploads. Must be replaced with an alternative (Supabase Storage, S3, Cloudflare R2).
2. **OAuth Callback URL**: Currently auto-detected from Replit domain env vars. Must be explicitly configured for new hosting.
3. **Scheduled Tasks**: `node-cron` runs in-process. On serverless (Vercel), these need to be replaced with cron jobs (Vercel Cron) or external schedulers.
4. **WebSocket support**: `ws` library is included but usage is minimal. Verify if needed.

---

## 11. DEPLOYMENT CONFIGURATION

### Vercel Deployment

#### Build Command
```bash
npm run build
```

#### Output Directory
```
dist/
├── public/          # Frontend static files (serve these)
└── index.js         # Backend entry point (ESM)
```

#### Environment Variables
All variables from Section 1 must be configured in Vercel project settings.

#### Key Considerations for Vercel

1. **API Routes**: The Express server runs as a standalone Node.js process. For Vercel, you'll need either:
   - A `vercel.json` with a custom server configuration
   - OR refactor API routes into Vercel serverless functions in `/api`

2. **Database**: Keep using Neon PostgreSQL (serverless-compatible). The `@neondatabase/serverless` driver already supports edge/serverless environments.

3. **Sessions**: `connect-pg-simple` works in serverless but each cold start creates a new connection. Consider switching to JWT-based auth for better serverless compatibility.

4. **Scheduled Tasks**: Replace `node-cron` with:
   - Vercel Cron Jobs (`vercel.json` cron config)
   - External cron service (e.g., cron-job.org)

5. **File Storage**: Replace Replit Object Storage with:
   - Supabase Storage
   - AWS S3 + presigned URLs
   - Cloudflare R2

6. **WebSocket**: Vercel doesn't support persistent WebSocket connections. If needed, use Pusher, Ably, or similar.

#### Suggested `vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "dist/public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "dist/index.js" },
    { "src": "/auth/(.*)", "dest": "dist/index.js" },
    { "src": "/health", "dest": "dist/index.js" },
    { "src": "/(.*)", "dest": "dist/public/$1" }
  ]
}
```

> **Note**: This is a starting point. The actual Vercel configuration will depend on whether you keep the Express monolith or refactor to serverless functions.

---

## Appendix: Key Type Definitions

### CmaBrochure
```typescript
interface CmaBrochure {
  type: "pdf" | "image";
  url: string;
  thumbnail?: string;
  filename: string;
  generated: boolean;
  uploadedAt: string;
}
```

### CmaAdjustmentRates
```typescript
interface CmaAdjustmentRates {
  sqftPerUnit: number;        // $/sqft (default: 50)
  bedroomValue: number;       // $/bedroom (default: 10000)
  bathroomValue: number;      // $/bathroom (default: 7500)
  poolValue: number;          // Pool yes/no (default: 25000)
  garagePerSpace: number;     // $/garage space (default: 5000)
  yearBuiltPerYear: number;   // $/year (default: 1000)
  lotSizePerSqft: number;     // $/lot sqft (default: 2)
}
```

### CoverPageConfig
```typescript
interface CoverPageConfig {
  title: string;
  subtitle: string;
  showDate: boolean;
  showAgentPhoto: boolean;
  background: "none" | "gradient" | "property";
}
```

### UserRole Hierarchy
```
agent < admin < super_admin < developer
```

### Permission List
```
developer.all, developer.debug, developer.manage_super_admins,
presentation_library.view, presentation_library.manage,
user_management.view, user_management.manage,
templates.create, templates.manage,
cma.create, cma.edit_own,
presentations.create, presentations.use_global_slides,
settings.manage_company, settings.manage_display,
analytics.view
```
