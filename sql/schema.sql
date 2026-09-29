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
  tags text NOT NULL DEFAULT '',
  UNIQUE (collection_id, catalog_card_id)
);

CREATE TABLE IF NOT EXISTS decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name text NOT NULL,
  format text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Uma linha por carta. As quantidades de deck, sideboard e fora do deck são colunas.
CREATE TABLE IF NOT EXISTS deck_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES decks (id) ON DELETE CASCADE,
  catalog_card_id uuid NOT NULL REFERENCES catalog_cards (id),
  quantity_main integer NOT NULL DEFAULT 0,
  quantity_side integer NOT NULL DEFAULT 0,
  quantity_out integer NOT NULL DEFAULT 0,
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  note text,
  tags text NOT NULL DEFAULT '',
  UNIQUE (deck_id, catalog_card_id),
  CONSTRAINT deck_cards_quantity_main_check CHECK (quantity_main >= 0),
  CONSTRAINT deck_cards_quantity_side_check CHECK (quantity_side >= 0),
  CONSTRAINT deck_cards_quantity_out_check CHECK (quantity_out >= 0),
  CONSTRAINT deck_cards_quantity_present CHECK (quantity_main + quantity_side + quantity_out > 0)
);

CREATE TABLE IF NOT EXISTS deck_canvas_konva (
  deck_id uuid PRIMARY KEY REFERENCES decks (id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
