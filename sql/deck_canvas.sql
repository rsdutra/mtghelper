CREATE TABLE IF NOT EXISTS deck_canvas (
  deck_id uuid PRIMARY KEY REFERENCES decks (id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
