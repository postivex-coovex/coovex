-- ─────────────────────────────────────────────────────────────
-- Meeting Calendar (Calendly-style scheduling)
-- Public pages and APIs use the service role; owners are protected by RLS.
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- One row per user: public profile, host timezone and Zoom credentials
CREATE TABLE IF NOT EXISTS meeting_settings (
  user_id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slug               TEXT        NOT NULL UNIQUE,
  display_name       TEXT,
  bio                TEXT,
  timezone           TEXT        NOT NULL DEFAULT 'UTC',
  host_email         TEXT,
  brand_color        TEXT        NOT NULL DEFAULT '#2563eb',
  zoom_account_id    TEXT,
  zoom_client_id     TEXT,
  zoom_client_secret TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bookable meeting types (e.g. "30 min intro call")
CREATE TABLE IF NOT EXISTS meeting_event_types (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug                  TEXT        NOT NULL,
  title                 TEXT        NOT NULL,
  description           TEXT,
  duration_min          INT         NOT NULL DEFAULT 30 CHECK (duration_min BETWEEN 5 AND 480),
  buffer_before_min     INT         NOT NULL DEFAULT 0  CHECK (buffer_before_min BETWEEN 0 AND 240),
  buffer_after_min      INT         NOT NULL DEFAULT 0  CHECK (buffer_after_min BETWEEN 0 AND 240),
  min_notice_hours      INT         NOT NULL DEFAULT 4  CHECK (min_notice_hours BETWEEN 0 AND 720),
  max_days_ahead        INT         NOT NULL DEFAULT 60 CHECK (max_days_ahead BETWEEN 1 AND 365),
  slot_interval_min     INT         NOT NULL DEFAULT 30 CHECK (slot_interval_min BETWEEN 5 AND 240),
  -- zoom: auto-create Zoom meeting | custom_link: fixed URL | phone | in_person
  -- host_provides: host adds the link/time when confirming
  location_type         TEXT        NOT NULL DEFAULT 'custom_link'
                        CHECK (location_type IN ('zoom','custom_link','phone','in_person','host_provides')),
  location_value        TEXT,
  requires_confirmation BOOLEAN     NOT NULL DEFAULT false,
  questions             JSONB       NOT NULL DEFAULT '[]',
  color                 TEXT        NOT NULL DEFAULT '#2563eb',
  active                BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

-- Weekly recurring availability, in the host timezone (minutes from midnight)
CREATE TABLE IF NOT EXISTS meeting_availability (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID     NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekday      SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0 = Sunday
  start_minute INT      NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute   INT      NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  CHECK (end_minute > start_minute)
);

-- Date-specific overrides. NULL start/end = unavailable all day; otherwise custom hours.
CREATE TABLE IF NOT EXISTS meeting_date_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  start_minute INT  CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute   INT  CHECK (end_minute BETWEEN 1 AND 1440),
  CHECK ((start_minute IS NULL AND end_minute IS NULL) OR (start_minute IS NOT NULL AND end_minute > start_minute))
);

CREATE TABLE IF NOT EXISTS meeting_bookings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type_id     UUID        REFERENCES meeting_event_types(id) ON DELETE SET NULL,
  event_title       TEXT        NOT NULL,
  start_at          TIMESTAMPTZ NOT NULL,
  end_at            TIMESTAMPTZ NOT NULL,
  invitee_name      TEXT        NOT NULL,
  invitee_email     TEXT        NOT NULL,
  invitee_phone     TEXT,
  invitee_timezone  TEXT        NOT NULL DEFAULT 'UTC',
  notes             TEXT,
  answers           JSONB       NOT NULL DEFAULT '[]',
  status            TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','declined','cancelled','completed','no_show')),
  location_type     TEXT,
  meeting_url       TEXT,
  location_details  TEXT,
  zoom_meeting_id   TEXT,
  host_message      TEXT,
  cancel_reason     TEXT,
  cancelled_by      TEXT,
  manage_token      TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  reminder_24h_sent BOOLEAN     NOT NULL DEFAULT false,
  reminder_1h_sent  BOOLEAN     NOT NULL DEFAULT false,
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

-- Database-level double-booking guard (pending + confirmed bookings may not overlap)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'meeting_bookings_no_overlap') THEN
    ALTER TABLE meeting_bookings
      ADD CONSTRAINT meeting_bookings_no_overlap
      EXCLUDE USING gist (user_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
      WHERE (status IN ('pending','confirmed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS meeting_event_types_user  ON meeting_event_types(user_id);
CREATE INDEX IF NOT EXISTS meeting_availability_user ON meeting_availability(user_id);
CREATE INDEX IF NOT EXISTS meeting_overrides_user    ON meeting_date_overrides(user_id, date);
CREATE INDEX IF NOT EXISTS meeting_bookings_user_start ON meeting_bookings(user_id, start_at);
CREATE INDEX IF NOT EXISTS meeting_bookings_status_start ON meeting_bookings(status, start_at);

-- RLS: owners manage their own rows. Public access goes through the API (service role).
ALTER TABLE meeting_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_event_types    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_availability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_bookings       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own meeting settings"  ON meeting_settings       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own meeting types"     ON meeting_event_types    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own availability"      ON meeting_availability   FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own date overrides"    ON meeting_date_overrides FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own meeting bookings"  ON meeting_bookings       FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
