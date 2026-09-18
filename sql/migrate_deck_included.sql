-- F-004 US-004-08: included + seções como tags
ALTER TABLE deck_cards
  ADD COLUMN IF NOT EXISTS included boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS deck_card_sections (
  deck_card_id uuid NOT NULL REFERENCES deck_cards (id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES deck_sections (id) ON DELETE CASCADE,
  PRIMARY KEY (deck_card_id, section_id)
);

CREATE INDEX IF NOT EXISTS deck_card_sections_section_idx ON deck_card_sections (section_id);

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

-- Cartas que estavam só na seção (acabaram de entrar com included=false) já ok.
-- Cartas que já estavam no deck e também na seção: ficam included=true + tag (não remove do deck).
