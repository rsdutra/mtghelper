import { expect, test, type Page } from "@playwright/test";

/** F-004 / US-004-18 — a sugestão da busca só seleciona; o botão Adicionar grava no destino escolhido. */
const stamp = Date.now();

type DeckCard = { name_en: string; place: string };

async function deckCards(page: Page, deckId: string) {
  const response = await page.request.get(`/api/decks/${deckId}`);
  return ((await response.json()) as { cards: DeckCard[] }).cards;
}

test("seleciona a carta na busca e adiciona pelo botão", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(`buscaadd${stamp}`);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  await page.getByLabel("Nome do deck").fill("Busca e adicionar");
  await page.getByLabel("Formato").selectOption("modern");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/decks\/[^/]+\/edit$/);
  const deckId = page.url().split("/decks/")[1].split("/")[0];

  await page.getByRole("button", { name: "Busca", exact: true }).click();
  const addButton = page.getByRole("button", { name: "Adicionar", exact: true });
  await expect(addButton).toBeDisabled();

  await page.getByLabel("Buscar carta").fill("Sol Ring");
  const suggestion = page.getByRole("button").filter({ hasText: "Sol Ring" }).first();
  await suggestion.click();

  const selected = page.getByTestId("search-selected-card");
  await expect(selected).toContainText("Sol Ring");
  await expect(addButton).toBeEnabled();
  await page.waitForTimeout(500);
  expect(await deckCards(page, deckId)).toEqual([]);

  // Limpar a seleção desabilita o botão.
  await page.getByRole("button", { name: "Limpar carta selecionada" }).click();
  await expect(selected).toHaveCount(0);
  await expect(addButton).toBeDisabled();

  await page.getByLabel("Buscar carta").fill("Sol Ring");
  await page.getByRole("button").filter({ hasText: "Sol Ring" }).first().click();
  await page.getByRole("button", { name: "Destino da busca" }).click();
  await page.getByRole("option", { name: "Adicionar fora do deck" }).click();
  await addButton.click();

  await expect(selected).toHaveCount(0);
  await expect(addButton).toBeDisabled();
  await expect
    .poll(async () => (await deckCards(page, deckId)).map((card) => `${card.name_en}:${card.place}`))
    .toEqual(["Sol Ring:out"]);
});
