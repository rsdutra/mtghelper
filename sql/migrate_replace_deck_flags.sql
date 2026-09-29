-- Troca included + in_sideboard por place. Não apaga linhas de deck_cards.

ALTER TABLE deck_cards
  ADD COLUMN IF NOT EXISTS place text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_cards' AND column_name = 'included'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_cards' AND column_name = 'in_sideboard'
  ) THEN
    UPDATE deck_cards
    SET place = CASE
      WHEN in_sideboard THEN 'side'
      WHEN included THEN 'main'
      ELSE 'out'
    END
    WHERE place IS NULL OR place NOT IN ('main', 'side', 'out');
  END IF;

  UPDATE deck_cards
  SET place = 'main'
  WHERE place IS NULL OR place NOT IN ('main', 'side', 'out');
END $$;

ALTER TABLE deck_cards ALTER COLUMN place SET DEFAULT 'main';
ALTER TABLE deck_cards ALTER COLUMN place SET NOT NULL;

ALTER TABLE deck_cards DROP CONSTRAINT IF EXISTS deck_cards_place_check;
ALTER TABLE deck_cards
  ADD CONSTRAINT deck_cards_place_check CHECK (place IN ('main', 'side', 'out'));

CREATE INDEX IF NOT EXISTS deck_cards_place_idx ON deck_cards (deck_id, place);

ALTER TABLE deck_cards DROP COLUMN IF EXISTS in_sideboard;
ALTER TABLE deck_cards DROP COLUMN IF EXISTS included;
