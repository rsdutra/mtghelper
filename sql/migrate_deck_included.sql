-- F-004 US-004-08: included + seções como tags.
-- Com a coluna place, este boolean não é recriado.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_cards' AND column_name = 'place'
  ) OR EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deck_cards' AND column_name = 'quantity_main'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE deck_cards
    ADD COLUMN IF NOT EXISTS included boolean NOT NULL DEFAULT true;
END $$;

-- deck_section_cards só existe em bancos anteriores a esta migração.
-- Se as seções já foram removidas, não recria as tabelas.
DO $$
BEGIN
  IF to_regclass('deck_sections') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE $sql$
    CREATE TABLE IF NOT EXISTS deck_card_sections (
      deck_card_id uuid NOT NULL REFERENCES deck_cards (id) ON DELETE CASCADE,
      section_id uuid NOT NULL REFERENCES deck_sections (id) ON DELETE CASCADE,
      PRIMARY KEY (deck_card_id, section_id)
    )
  $sql$;
  EXECUTE 'CREATE INDEX IF NOT EXISTS deck_card_sections_section_idx ON deck_card_sections (section_id)';

  IF to_regclass('deck_section_cards') IS NULL THEN
    RETURN;
  END IF;

  -- Migrar cartas que só existiam em seções → deck_cards (included=false) + tag
  INSERT INTO deck_cards (deck_id, catalog_card_id, quantity, included)
  SELECT ds.deck_id, dsc.catalog_card_id, dsc.quantity, false
  FROM deck_section_cards dsc
  JOIN deck_sections ds ON ds.id = dsc.section_id
  ON CONFLICT (deck_id, catalog_card_id) DO NOTHING;

  -- Tag: todas as linhas de deck_section_cards
  INSERT INTO deck_card_sections (deck_card_id, section_id)
  SELECT dc.id, dsc.section_id
  FROM deck_section_cards dsc
  JOIN deck_sections ds ON ds.id = dsc.section_id
  JOIN deck_cards dc ON dc.deck_id = ds.deck_id AND dc.catalog_card_id = dsc.catalog_card_id
  ON CONFLICT DO NOTHING;
END $$;

-- Cartas que estavam só na seção (acabaram de entrar com included=false) já ok.
-- Cartas que já estavam no deck e também na seção: ficam included=true + tag (não remove do deck).
