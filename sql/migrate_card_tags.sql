-- F-013: tags da carta numa coluna de texto, para busca por nome.
ALTER TABLE deck_cards ADD COLUMN IF NOT EXISTS tags text NOT NULL DEFAULT '';
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS tags text NOT NULL DEFAULT '';
