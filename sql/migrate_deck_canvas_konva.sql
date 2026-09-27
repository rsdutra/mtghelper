-- F-008 / US-008-08: snapshot do Canvas v2 (Konva), separado do tldraw.
CREATE TABLE IF NOT EXISTS deck_canvas_konva (
  deck_id uuid PRIMARY KEY REFERENCES decks (id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
