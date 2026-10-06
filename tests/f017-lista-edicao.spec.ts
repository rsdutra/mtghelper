import { expect, test, type Page } from "@playwright/test";

/** F-017 — lista da edição: preview ao lado, menu, custo de mana e tags. */
const stamp = Date.now();
const login = `listaedit${stamp}`;
const password = "senha123";

type DeckCard = { name_en: string; name_pt: string | null; mana_cost: string | null };

async function cardOf(page: Page, deckId: string, nameEn: string) {
  const response = await page.request.get(`/api/decks/${deckId}`);
  const data = (await response.json()) as { cards: DeckCard[] };
  const card = data.cards.find((item) => item.name_en === nameEn);
  if (!card) throw new Error(`carta ${nameEn} não está no deck`);
  return card;
}

test("edição em texto: preview ao lado, opções, custo de mana e tags", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const registered = await page.request.post("/api/auth/register", { data: { login, password } });
  expect(registered.ok()).toBeTruthy();

  const created = await page.request.post("/api/decks", { data: { name: "F017 Lista", format: "modern" } });
  expect(created.ok()).toBeTruthy();
  const deckId = ((await created.json()) as { deck: { id: string } }).deck.id;

  const added = await page.request.post(`/api/decks/${deckId}/cards`, {
    data: { text: "1 Lightning Bolt", place: "main" },
  });
  expect(added.ok()).toBeTruthy();
  const bolt = await cardOf(page, deckId, "Lightning Bolt");
  const label = bolt.name_pt ?? bolt.name_en;

  await page.goto(`/decks/${deckId}/edit`);
  const row = page.getByTestId("deck-card-text").filter({ hasText: label });
  await expect(row).toBeVisible();
  await expect(page.getByTestId("deck-view-texto").first().locator("img")).toHaveCount(0);
  await expect(page.getByTestId("deck-side-preview")).toContainText("Passe o cursor sobre uma carta");
  await expect(row.getByRole("button", { name: `Opções de ${label}` })).toBeHidden();

  await row.hover();
  await expect(page.getByTestId("card-hover-preview")).toHaveCount(0);
  await expect(page.getByTestId("deck-side-preview").getByRole("img", { name: label })).toBeVisible();
  await expect(row).toHaveAttribute("data-active", "true");

  await row.hover();
  await expect(row.getByRole("button", { name: `Opções de ${label}` })).toBeVisible();
  await row.getByRole("button", { name: `Opções de ${label}` }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: `Aumentar ${label}` })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: `Diminuir ${label}` })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: `Remover todas as cópias de ${label}` })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Detalhes" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Copiar nome" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Maybeboard" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "No deck" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Sideboard" })).toBeVisible();

  await menu.getByRole("menuitem", { name: "Nova tag…" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova tag" });
  await dialog.getByLabel("Nome", { exact: true }).fill("Burn");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  // F-019: as bolinhas de tag dependem de “Tags” no Exibir, desligado por padrão.
  await expect(row.getByTitle("Burn")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Itens da lista" }).click();
  const tags = page.getByRole("checkbox", { name: "Tags" });
  await expect(tags).not.toBeChecked();
  await tags.check();
  await expect(row.getByTitle("Burn")).toBeVisible();
  const mana = page.getByRole("checkbox", { name: "Custo de mana" });
  await expect(mana).not.toBeChecked();
  await mana.check();
  await expect(row.getByTestId("mana-cost")).toHaveAttribute("aria-label", `Custo de mana ${bolt.mana_cost}`);
  await expect(row.getByTestId("mana-cost").locator("img")).toHaveAttribute("src", /\/R\.svg$/);

  await page.reload();
  await page.getByRole("button", { name: "Itens da lista" }).click();
  await expect(page.getByRole("checkbox", { name: "Custo de mana" })).toBeChecked();
  await expect(page.getByTestId("deck-card-text").filter({ hasText: label }).getByTestId("mana-cost")).toBeVisible();

  await page.getByRole("checkbox", { name: "Custo de mana" }).uncheck();
  await expect(page.getByTestId("mana-cost")).toHaveCount(0);

  await page.getByLabel("Visualização").selectOption("grid");
  await expect(page.getByTestId("deck-side-preview")).toHaveCount(0);
  const tile = page.getByTestId("deck-card-tile").filter({ has: page.getByRole("img", { name: label }) });
  await tile.getByRole("img", { name: label }).hover();
  await expect(page.getByTestId("card-hover-preview")).toBeVisible();
});
