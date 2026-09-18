-- F-004 / F-005 — preço (centavos BRL) e nota (HTML) por carta no deck e na coleção
ALTER TABLE deck_cards
  ADD COLUMN IF NOT EXISTS price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  ADD COLUMN IF NOT EXISTS note text;
