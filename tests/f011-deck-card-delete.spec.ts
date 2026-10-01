import { expect, test, type Locator, type Page } from "@playwright/test";

/** F-011 / US-011-04 — remover cartas do deck no modo edição (lista). */
const stamp = Date.now();
const login = `deckdel${stamp}`;
const password = "senha123";

type DeckCard = { name_en: string; name_pt: string | null; quantity: number; place: string };

async function deckCards(page: Page, deckId: string) {
  const response = await page.request.get(`/api/decks/${deckId}`);
  return ((await response.json()) as { cards: DeckCard[] }).cards;
}

async function placesOf(page: Page, deckId: string, nameEn: string) {
  return (await deckCards(page, deckId))
    .filter((card) => card.name_en === nameEn)
    .map((card) => `${card.place}:${card.quantity}`)
    .sort();
}

async function cardLabel(page: Page, deckId: string, nameEn: string) {
  const card = (await deckCards(page, deckId)).find((item) => item.name_en === nameEn);
  if (!card) throw new Error(`carta ${nameEn} não está no deck`);
  return card.name_pt ?? card.name_en;
}

function panel(page: Page, title: string) {
  return page.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title, exact: true }) });
}

async function clickAndExpectDelete(page: Page, deckId: string, button: Locator) {
  const deleted = page.waitForResponse(
    (response) => response.url().endsWith(`/api/decks/${deckId}/cards`) && response.request().method() === "DELETE",
  );
  await button.click();
  const response = await deleted;
  const body = await response.text().catch(() => "");
  expect(response.status(), body).toBe(200);
}

test("remover cópias e a carta inteira na lista de edição", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const registered = await page.request.post("/api/auth/register", { data: { login, password } });
  expect(registered.ok()).toBeTruthy();

  const created = await page.request.post("/api/decks", { data: { name: "F011 Delete", format: "modern" } });
  expect(created.ok()).toBeTruthy();
  const deckId = ((await created.json()) as { deck: { id: string } }).deck.id;

  const main = await page.request.post(`/api/decks/${deckId}/cards`, {
    data: { text: "3 Lightning Bolt\n1 Sol Ring\n2 Command Tower", place: "main" },
  });
  expect(main.ok()).toBeTruthy();
  const out = await page.request.post(`/api/decks/${deckId}/cards`, {
    data: { text: "1 Command Tower", place: "out" },
  });
  expect(out.ok()).toBeTruthy();

  const bolt = await cardLabel(page, deckId, "Lightning Bolt");
  const solRing = await cardLabel(page, deckId, "Sol Ring");
  const tower = await cardLabel(page, deckId, "Command Tower");

  await page.goto(`/decks/${deckId}/edit`);
  const deckPanel = panel(page, "No deck");
  const outPanel = panel(page, "Fora do deck");
  await expect(deckPanel.getByRole("button", { name: `Diminuir ${bolt}` })).toBeVisible();

  // Diminuir tira 1 cópia.
  await clickAndExpectDelete(page, deckId, deckPanel.getByRole("button", { name: `Diminuir ${bolt}` }));
  await expect(deckPanel.getByLabel(`Quantidade de ${bolt}`)).toHaveText(/^2/);
  expect(await placesOf(page, deckId, "Lightning Bolt")).toEqual(["main:2"]);

  // Diminuir a última cópia remove a carta.
  await clickAndExpectDelete(page, deckId, deckPanel.getByRole("button", { name: `Diminuir ${solRing}` }));
  await expect(page.getByRole("button", { name: `Diminuir ${solRing}` })).toHaveCount(0);
  expect(await placesOf(page, deckId, "Sol Ring")).toEqual([]);

  // Lixeira remove todas as cópias.
  await clickAndExpectDelete(
    page,
    deckId,
    deckPanel.getByRole("button", { name: `Remover todas as cópias de ${bolt}` }),
  );
  await expect(page.getByRole("button", { name: `Diminuir ${bolt}` })).toHaveCount(0);
  expect(await placesOf(page, deckId, "Lightning Bolt")).toEqual([]);

  // Remover do deck mantém as cópias de outro lugar.
  await clickAndExpectDelete(
    page,
    deckId,
    deckPanel.getByRole("button", { name: `Remover todas as cópias de ${tower}` }),
  );
  await expect(deckPanel.getByRole("button", { name: `Diminuir ${tower}` })).toHaveCount(0);
  await expect(outPanel.getByRole("button", { name: `Diminuir ${tower}` })).toBeVisible();
  expect(await placesOf(page, deckId, "Command Tower")).toEqual(["out:1"]);

  // Persistiu: recarregar não traz as cartas de volta.
  await page.reload();
  await expect(deckPanel.getByText("Nenhuma carta incluída.")).toBeVisible();
  await expect(outPanel.getByRole("button", { name: `Diminuir ${tower}` })).toBeVisible();
});
