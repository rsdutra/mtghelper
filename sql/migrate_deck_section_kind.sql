-- F-004 / F-008 — seções automáticas por tipo (kind=type).
-- Se deck_sections já foi removida, o bloco não faz nada.
DO $$
BEGIN
  IF to_regclass('deck_sections') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE deck_sections
    ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS type_key text;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deck_sections_kind_check'
  ) THEN
    ALTER TABLE deck_sections
      ADD CONSTRAINT deck_sections_kind_check CHECK (kind IN ('user', 'type'));
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS deck_sections_type_key_uidx ON deck_sections (deck_id, type_key) WHERE type_key IS NOT NULL';
END $$;
