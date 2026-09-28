import { sql } from "@/lib/db";
import { sideboardLimit } from "@/lib/formats";

export async function syncSideboardSection(deckId: string, format: string) {
  if (sideboardLimit(format) == null) {
    await sql`DELETE FROM deck_sections WHERE deck_id = ${deckId} AND kind = 'sideboard'`;
    return;
  }

  await sql`
    INSERT INTO deck_sections (deck_id, name, position, kind)
    VALUES (${deckId}, 'Sideboard', 0, 'sideboard')
    ON CONFLICT (deck_id) WHERE kind = 'sideboard' DO NOTHING
  `;
}
