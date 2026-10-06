import { loadEnvConfig } from "@next/env";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

/**
 * F-006 / US-006-04 — o catálogo guarda a impressão em inglês; o português fica só no nome.
 * Cartas antigas ligadas a impressões em português passam para a inglesa ao abrir o deck ou a coleção.
 */
loadEnvConfig(process.cwd());
const stamp = Date.now();

type ApiCard = {
  id: string;
  name_en: string;
  name_pt: string | null;
  lang: string | null;
  place: "main" | "side" | "out";
  quantity: number;
  usd: number | null;
  price_cents: number | null;
  note: string | null;
  tags: { name: string; color: string }[];
};

async function register(page: Page, login: string) {
  const registered = await page.request.post("/api/auth/register", { data: { login, password: "senha123" } });
  expect(registered.ok()).toBeTruthy();
}

async function createDeck(page: Page, name: string) {
  const created = await page.request.post("/api/decks", { data: { name, format: "modern" } });
  return ((await created.json()) as { deck: { id: string } }).deck.id;
}

async function deckCards(page: Page, deckId: string) {
  return ((await (await page.request.get(`/api/decks/${deckId}`)).json()) as { cards: ApiCard[] }).cards;
}

test("nome em português grava a impressão em inglês, com preço", async ({ page }) => {
  await register(page, `ingles${stamp}`);
  const deckId = await createDeck(page, "F006 Inglês");
  const added = await page.request.post(`/api/decks/${deckId}/cards`, { data: { text: "2 Contramágica", place: "main" } });
  expect(added.ok()).toBeTruthy();
  expect(((await added.json()) as { missing: unknown[] }).missing).toEqual([]);

  const [card] = await deckCards(page, deckId);
  expect(card.name_en).toBe("Counterspell");
  expect(card.name_pt).toBe("Contramágica");
  expect(card.lang).toBe("en");
  expect(typeof card.usd).toBe("number");

  // Sugestão da busca em português também aponta para a impressão em inglês.
  const suggest = await page.request.get(`/api/cards/suggest?q=${encodeURIComponent("Contramágica")}`);
  const { suggestions } = (await suggest.json()) as { suggestions: { catalogId: string; namePt: string | null }[] };
  expect(suggestions.length).toBeGreaterThan(0);
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    const rows = await sql<{ lang: string | null }[]>`
      SELECT lang FROM catalog_cards WHERE id IN ${sql(suggestions.map((item) => item.catalogId))}
    `;
    expect(rows.every((row) => (row.lang ?? "en") === "en")).toBe(true);
  } finally {
    await sql.end();
  }
});

test("converte cartas antigas em português ao abrir o deck e a coleção", async ({ page }) => {
  await register(page, `converte${stamp}`);
  const deckId = await createDeck(page, "F006 Converter");
  expect((await page.request.post(`/api/decks/${deckId}/cards`, { data: { text: "2 Lightning Bolt", place: "main" } })).ok()).toBeTruthy();
  const createdCollection = await page.request.post("/api/collections", { data: { name: "F006 Coleção" } });
  const collectionId = ((await createdCollection.json()) as { collection: { id: string } }).collection.id;

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const legacyIds: string[] = [];
  try {
    const [bolt] = await sql<{ id: string; set_code: string; collector_number: string }[]>`
      SELECT c.id, c.set_code, c.collector_number
      FROM deck_cards dc JOIN catalog_cards c ON c.id = dc.catalog_card_id
      WHERE dc.deck_id = ${deckId}
    `;

    // Impressões em português como o app gravava antes: Contramágica (CMM #81) e o mesmo Raio que já está no deck.
    const [counterPt] = await sql<{ id: string }[]>`
      INSERT INTO catalog_cards (scryfall_id, name_en, name_pt, set_code, collector_number, lang)
      VALUES (${`f006-counter-${stamp}`}, 'Counterspell', 'Contramágica', 'cmm', '81', 'pt')
      RETURNING id
    `;
    const [boltPt] = await sql<{ id: string }[]>`
      INSERT INTO catalog_cards (scryfall_id, name_en, name_pt, set_code, collector_number, lang)
      VALUES (${`f006-bolt-${stamp}`}, 'Lightning Bolt', 'Raio', ${bolt.set_code}, ${bolt.collector_number}, 'pt')
      RETURNING id
    `;
    legacyIds.push(counterPt.id, boltPt.id);

    await sql`
      INSERT INTO deck_cards (deck_id, catalog_card_id, quantity_out, price_cents, note, tags)
      VALUES (${deckId}, ${counterPt.id}, 1, 500, 'nota antiga', 'Controle|#2563eb')
    `;
    await sql`
      INSERT INTO deck_cards (deck_id, catalog_card_id, quantity_side, tags)
      VALUES (${deckId}, ${boltPt.id}, 1, 'Burn|#d03030')
    `;
    await sql`
      INSERT INTO deck_canvas_konva (deck_id, snapshot)
      VALUES (${deckId}, ${sql.json({ nodes: [{ key: `card:${counterPt.id}:out:0` }] })})
    `;
    await sql`
      INSERT INTO collection_items (collection_id, catalog_card_id, quantity, note)
      VALUES (${collectionId}, ${counterPt.id}, 3, 'na pasta')
    `;

    // Abrir o deck converte.
    const cards = await deckCards(page, deckId);
    expect(cards.every((card) => card.lang === "en")).toBe(true);
    const counter = cards.find((card) => card.name_en === "Counterspell");
    expect(counter).toMatchObject({ place: "out", quantity: 1, name_pt: "Contramágica", price_cents: 500, note: "nota antiga" });
    expect(counter?.tags).toEqual([{ name: "Controle", color: "#2563eb" }]);
    expect(typeof counter?.usd).toBe("number");

    // O Raio em português se junta à linha em inglês que já estava no deck.
    const bolts = cards.filter((card) => card.name_en === "Lightning Bolt");
    expect(bolts.map((card) => `${card.place} ${card.quantity}`).sort()).toEqual(["main 2", "side 1"]);
    expect(new Set(bolts.map((card) => card.id)).size).toBe(1);
    expect(bolts[0].id).toBe(bolt.id);
    expect(bolts[0].tags).toEqual([{ name: "Burn", color: "#d03030" }]);

    // O canvas acompanha a troca de impressão.
    const canvas = (await (await page.request.get(`/api/decks/${deckId}/canvas`)).json()) as { snapshot: unknown };
    const snapshot = JSON.stringify(canvas.snapshot);
    expect(snapshot).toContain(`card:${counter!.id}:out:0`);
    expect(snapshot).not.toContain(counterPt.id);

    // Abrir a coleção converte também.
    const collection = (await (await page.request.get(`/api/collections/${collectionId}`)).json()) as {
      items: { id: string; name_en: string; name_pt: string | null; lang: string | null; quantity: number; note: string | null }[];
    };
    expect(collection.items).toHaveLength(1);
    expect(collection.items[0]).toMatchObject({
      id: counter!.id,
      name_en: "Counterspell",
      name_pt: "Contramágica",
      lang: "en",
      quantity: 3,
      note: "na pasta",
    });

    const leftovers = await sql`
      SELECT 1 FROM deck_cards WHERE catalog_card_id IN ${sql(legacyIds)}
      UNION ALL
      SELECT 1 FROM collection_items WHERE catalog_card_id IN ${sql(legacyIds)}
    `;
    expect(leftovers).toHaveLength(0);
  } finally {
    await sql`DELETE FROM deck_cards WHERE deck_id = ${deckId}`;
    await sql`DELETE FROM collection_items WHERE collection_id = ${collectionId}`;
    if (legacyIds.length) await sql`DELETE FROM catalog_cards WHERE id IN ${sql(legacyIds)}`;
    await sql.end();
  }
});
