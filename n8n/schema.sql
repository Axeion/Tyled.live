-- Tyled — Neon PostgreSQL Schema
-- Run once: psql $DATABASE_URL < n8n/schema.sql

CREATE TABLE IF NOT EXISTS tyled_minutes (
  id             SERIAL PRIMARY KEY,
  meeting        TEXT,
  motions        JSONB        DEFAULT '[]',
  funds          JSONB        DEFAULT '[]',
  notes          JSONB        DEFAULT '[]',
  parsed_at      TIMESTAMPTZ  DEFAULT NOW(),
  source_message TEXT         UNIQUE,   -- Discord message ID, prevents duplicate imports
  posted_by      TEXT
);

CREATE TABLE IF NOT EXISTS tyled_checkins (
  id            SERIAL PRIMARY KEY,
  name          TEXT        NOT NULL,
  role          TEXT,
  avatar_url    TEXT,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  event_date    DATE        DEFAULT CURRENT_DATE,
  UNIQUE (name, event_date)             -- one check-in per member per night
);

CREATE TABLE IF NOT EXISTS tyled_photos (
  id         SERIAL PRIMARY KEY,
  image_url  TEXT,
  caption    TEXT,
  post_url   TEXT,
  date       TEXT,
  likes      INTEGER,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lodge_members (
  id        SERIAL PRIMARY KEY,
  name      TEXT    UNIQUE NOT NULL,
  role      TEXT,
  email     TEXT,
  phone     TEXT,
  dues_paid BOOLEAN DEFAULT FALSE,
  active    BOOLEAN DEFAULT TRUE
);
