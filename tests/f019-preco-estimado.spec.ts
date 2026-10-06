import { expect, test, type Page } from "@playwright/test";
import { estimatedLineCents, estimatedLineLabel } from "../src/lib/estimated-price";

/**
 * F-019 / US-019-01 — preço estimado (US$ × 5) na linha da view Texto, opcional no Exibir.
 * F-019 / US-019-02 — tags opcionais no Exibir, coluna mais estreita.
 * F-019 / US-019-03 — Exibir também na visualização.
 */
const stamp = Date.now();

type ApiCard = { id: string; name_en: string; name_pt: string | null; quantity: number; usd: number | null };

test("calcula o total estimado da linha", () => {
  expect(estimatedLineCents(0.19, 4)).toBe(380);
  expect(estimatedLineCents(1.234, 1)).toBe(617);
  expect(estimatedLineCents(null, 4)).toBeNull();
  expect(estimatedLineLabel(0.19, 4)).toMatch(/^R\$\s3,80$/);
  expect(estimatedLineLabel(250, 4)).toMatch(/^R\$\s5\.000,00$/);
  expect(estimatedLineLabel(undefined, 1)).toBeNull();
});

async function boltOf(page: Page, deckId: string) {
  const data = (await (await page.request.get(`/api/decks/${deckId}`)).json()) as { cards: ApiCard[] };
  const bolt = data.cards.find((card) => card.name_en === "Lightning Bolt");
  if (!bolt) throw new Error("Lightning Bolt não está no deck");
  return bolt;
}

test("preço estimado e tags pelo menu Exibir, na edição e na visualização", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const registered = await page.request.post("/api/auth/register", {
    data: { login: `preco${stamp}`, password: "senha123" },
  });
  expect(registered.ok()).toBeTruthy();
  const created = await page.request.post("/api/decks", { data: { name: "F019 Preço", format: "modern" } });
  const deckId = ((await created.json()) as { deck: { id: string } }).deck.id;
  const added = await page.request.post(`/api/decks/${deckId}/cards`, { data: { text: "4 Lightning Bolt", place: "main" } });
  expect(added.ok()).toBeTruthy();

  const bolt = await boltOf(page, deckId);
  expect(typeof bolt.usd).toBe("number");
  const label = bolt.name_pt ?? bolt.name_en;
  const expected = estimatedLineLabel(bolt.usd, 4);
  expect(expected).toBeTruthy();

  const tag = { name: "Burn", color: "#d03030" };
  const patched = await page.request.patch(`/api/decks/${deckId}/cards`, { data: { catalogCardId: bolt.id, tags: [tag] } });
  expect(patched.ok()).toBeTruthy();

  await page.goto(`/decks/${deckId}/edit`);
  const row = page.getByTestId("deck-card-text").filter({ hasText: label });
  await expect(row).toBeVisible();

  // Tudo desligado por padrão: sem preço e sem bolinhas.
  await expect(row.getByTestId("deck-card-price")).toHaveCount(0);
  await expect(row.getByTitle("Burn")).toHaveCount(0);

  await page.getByRole("button", { name: "Itens da lista" }).click();
  const options = page.getByRole("group", { name: "Itens opcionais da lista" });
  await expect(options.getByRole("checkbox")).toHaveCount(3);
  await expect(options.locator("label")).toHaveText(["Custo de mana", "Tags", "Preço estimado"]);
  for (const name of ["Custo de mana", "Tags", "Preço estimado"]) {
    await expect(options.getByRole("checkbox", { name })).not.toBeChecked();
  }

  // US-019-01: total da linha em R$ com a dica “Valor estimado”.
  await options.getByRole("checkbox", { name: "Preço estimado" }).check();
  const price = row.getByTestId("deck-card-price");
  await expect(price).toHaveText(expected!);
  await expect(price).toHaveAttribute("title", "Valor estimado");

  // US-019-02: bolinhas opcionais numa coluna de 1.75rem (antes 2.25rem).
  await options.getByRole("checkbox", { name: "Tags" }).check();
  await expect(row.getByTitle("Burn")).toBeVisible();
  const firstColumn = await row.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ")[0]);
  expect(firstColumn).toBe("28px");
  await options.getByRole("checkbox", { name: "Tags" }).uncheck();
  await expect(row.getByTitle("Burn")).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Grid não mostra preço.
  await page.getByLabel("Visualização").selectOption("grid");
  await expect(page.getByTestId("deck-card-price")).toHaveCount(0);
  await page.getByLabel("Visualização").selectOption("texto");

  // US-019-03: visualização com o mesmo Exibir e a mesma escolha.
  await page.goto(`/decks/${deckId}`);
  const viewRow = page.getByTestId("deck-card-text").filter({ hasText: label });
  await expect(viewRow.getByTestId("deck-card-price")).toHaveText(expected!);
  await page.getByRole("button", { name: "Itens da lista" }).click();
  const viewOptions = page.getByRole("group", { name: "Itens opcionais da lista" });
  await expect(viewOptions.getByRole("checkbox", { name: "Preço estimado" })).toBeChecked();
  await viewOptions.getByRole("checkbox", { name: "Tags" }).check();
  await expect(viewRow.getByTitle("Burn")).toBeVisible();
  await viewOptions.getByRole("checkbox", { name: "Custo de mana" }).check();
  await expect(viewRow.getByTestId("mana-cost")).toBeVisible();
  await viewOptions.getByRole("checkbox", { name: "Preço estimado" }).uncheck();
  await expect(viewRow.getByTestId("deck-card-price")).toHaveCount(0);
});
