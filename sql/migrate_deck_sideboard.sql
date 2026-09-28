-- Sideboard padrão: seção fixa, no máximo uma por deck.
ALTER TABLE deck_sections DROP CONSTRAINT IF EXISTS deck_sections_kind_check;
ALTER TABLE deck_sections
  ADD CONSTRAINT deck_sections_kind_check CHECK (kind IN ('user', 'type', 'cost', 'sideboard'));

CREATE UNIQUE INDEX IF NOT EXISTS deck_sections_sideboard_uidx
  ON deck_sections (deck_id)
  WHERE kind = 'sideboard';
