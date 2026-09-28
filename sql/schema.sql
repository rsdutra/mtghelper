CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scryfall_id text NOT NULL UNIQUE,
  oracle_id text,
  name_en text NOT NULL,
  name_pt text,
  set_code text NOT NULL,
  set_name text,
  collector_number text,
  released_at date,
  image_small text,
  image_normal text,
  lang text,
  type_line text,
  mana_cost text,
  filters jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_cards_name_en_idx ON catalog_cards (lower(name_en));
CREATE INDEX IF NOT EXISTS catalog_cards_name_pt_idx ON catalog_cards (lower(name_pt));
CREATE INDEX IF NOT EXISTS catalog_cards_oracle_idx ON catalog_cards (oracle_id);

CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
  catalog_card_id uuid NOT NULL REFERENCES catalog_cards (id),
  quantity integer NOT NULL CHECK (quantity > 0),
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  note text,
  UNIQUE (collection_id, catalog_card_id)
);

CREATE TABLE IF NOT EXISTS decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  format text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deck_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
  catalog_card_id uuid NOT NULL REFERENCES catalog_cards (id),
  quantity integer NOT NULL CHECK (quantity > 0),
  included boolean NOT NULL DEFAULT true,
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  note text,
  UNIQUE (deck_id, catalog_card_id)
);

CREATE TABLE IF NOT EXISTS deck_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'user' CHECK (kind IN ('user', 'type', 'cost')),
  type_key text
);

CREATE UNIQUE INDEX IF NOT EXISTS deck_sections_type_key_uidx
  ON deck_sections (deck_id, type_key)
  WHERE type_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS deck_card_sections (
  deck_card_id uuid NOT NULL REFERENCES deck_cards (id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES deck_sections (id) ON DELETE CASCADE,
  PRIMARY KEY (deck_card_id, section_id)
);

CREATE INDEX IF NOT EXISTS deck_card_sections_section_idx ON deck_card_sections (section_id);

CREATE TABLE IF NOT EXISTS deck_canvas_konva (
  deck_id uuid PRIMARY KEY REFERENCES decks (id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
