-- F-005 / US-005-07 — metadados Scryfall para filtrar a coleção localmente
ALTER TABLE catalog_cards
  ADD COLUMN IF NOT EXISTS filters jsonb;
