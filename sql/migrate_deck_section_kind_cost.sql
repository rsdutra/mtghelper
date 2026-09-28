-- F-004 / F-008 — seções automáticas por custo (kind=cost).
DO $$
BEGIN
  IF to_regclass('deck_sections') IS NULL THEN
    RETURN;
  END IF;

  -- Um restart não pode reaplicar um check mais estreito se já houver sideboard.
  IF EXISTS (SELECT 1 FROM deck_sections WHERE kind NOT IN ('user', 'type', 'cost')) THEN
    RETURN;
  END IF;

  ALTER TABLE deck_sections DROP CONSTRAINT IF EXISTS deck_sections_kind_check;
  ALTER TABLE deck_sections
    ADD CONSTRAINT deck_sections_kind_check CHECK (kind IN ('user', 'type', 'cost'));
END $$;
