-- Remove seções/tags. Copia o sideboard para deck_cards antes de apagar as tabelas.
-- Não remove usuários, coleções, catálogo, decks, deck_cards nem o snapshot do canvas.

ALTER TABLE deck_cards
  ADD COLUMN IF NOT EXISTS in_sideboard boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF to_regclass('deck_sections') IS NULL OR to_regclass('deck_card_sections') IS NULL THEN
    RETURN;
  END IF;

  UPDATE deck_cards AS dc
  SET in_sideboard = true,
      included = true
  FROM deck_card_sections AS dcs
  JOIN deck_sections AS ds ON ds.id = dcs.section_id
  WHERE dcs.deck_card_id = dc.id
    AND ds.kind = 'sideboard';
END $$;

DROP TABLE IF EXISTS deck_card_sections;
DROP TABLE IF EXISTS deck_sections;
