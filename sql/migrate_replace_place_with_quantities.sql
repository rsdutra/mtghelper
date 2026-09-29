-- Uma linha por carta, com quantidade separada para deck, sideboard e fora do deck.
-- Importar uma lista num lugar soma só aquela coluna.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_cards' AND column_name = 'quantity_main'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_cards' AND column_name = 'place'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_cards' AND column_name = 'quantity_main'
  ) THEN
    ALTER TABLE deck_cards
      ADD COLUMN quantity_main integer NOT NULL DEFAULT 0,
      ADD COLUMN quantity_side integer NOT NULL DEFAULT 0,
      ADD COLUMN quantity_out integer NOT NULL DEFAULT 0;
    ALTER TABLE deck_cards
      ADD CONSTRAINT deck_cards_quantity_main_check CHECK (quantity_main >= 0),
      ADD CONSTRAINT deck_cards_quantity_side_check CHECK (quantity_side >= 0),
      ADD CONSTRAINT deck_cards_quantity_out_check CHECK (quantity_out >= 0);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_cards' AND column_name = 'place'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_cards' AND column_name = 'quantity'
  ) THEN
    UPDATE deck_cards
    SET quantity_main = CASE WHEN place = 'main' THEN quantity ELSE 0 END,
        quantity_side = CASE WHEN place = 'side' THEN quantity ELSE 0 END,
        quantity_out = CASE WHEN place = 'out' THEN quantity ELSE 0 END;
  END IF;

  ALTER TABLE deck_cards DROP CONSTRAINT IF EXISTS deck_cards_place_check;
  DROP INDEX IF EXISTS deck_cards_place_idx;
  ALTER TABLE deck_cards DROP COLUMN IF EXISTS place;
  ALTER TABLE deck_cards DROP COLUMN IF EXISTS quantity;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deck_cards_quantity_present'
  ) THEN
    ALTER TABLE deck_cards
      ADD CONSTRAINT deck_cards_quantity_present
      CHECK (quantity_main + quantity_side + quantity_out > 0);
  END IF;
END $$;
