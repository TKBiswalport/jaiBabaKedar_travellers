-- Runs on every server start. Safe to re-run: it only creates what's missing.
-- IDs are 24-char hex strings (same format as MongoDB ObjectIds) so migrated
-- records keep their IDs and existing login tokens stay valid.

CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  mobile             TEXT NOT NULL,
  email              TEXT NOT NULL UNIQUE,
  password           TEXT NOT NULL,
  reset_token        TEXT,
  reset_token_expiry TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  vehicle_id       TEXT NOT NULL CHECK (vehicle_id IN ('swift-dzire', 'ertiga', 'innova', 'tempo-13', 'tempo-17', 'bus-28', 'bus-32')),
  vehicle_name     TEXT NOT NULL,
  seats            INTEGER[] NOT NULL DEFAULT '{}',
  amount           DOUBLE PRECISION NOT NULL,
  travelers        INTEGER NOT NULL DEFAULT 1,
  travel_date      TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  package_id       TEXT,
  package_title    TEXT,
  package_duration TEXT,
  plan_label       TEXT,
  plan_price       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_vehicle_date_idx ON orders (vehicle_id, travel_date);

CREATE TABLE IF NOT EXISTS enquiries (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  travel_date      TIMESTAMPTZ NOT NULL,
  passengers       INTEGER NOT NULL DEFAULT 1 CHECK (passengers >= 1),
  message          TEXT NOT NULL DEFAULT '',
  vehicle_id       TEXT NOT NULL CHECK (vehicle_id IN ('swift-dzire', 'ertiga', 'innova')),
  vehicle_name     TEXT NOT NULL,
  package_id       TEXT,
  package_title    TEXT,
  package_duration TEXT,
  plan_label       TEXT,
  plan_price       TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'closed')),
  availability     TEXT NOT NULL DEFAULT 'pending' CHECK (availability IN ('pending', 'available', 'not_available')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id            TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  title         TEXT NOT NULL,
  media_url     TEXT NOT NULL,
  public_id     TEXT NOT NULL,
  media_type    TEXT NOT NULL CHECK (media_type IN ('video', 'image')),
  thumbnail     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
