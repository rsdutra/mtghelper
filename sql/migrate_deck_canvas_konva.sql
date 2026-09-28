-- F-008 / US-008-08: snapshot do canvas (Konva). A antiga deck_canvas (tldraw) não é mais lida.
CREATE TABLE IF NOT EXISTS deck_canvas_konva (
  deck_id uuid PRIMARY KEY REFERENCES decks (id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
