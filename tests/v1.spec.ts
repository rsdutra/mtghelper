import { expect, test } from "@playwright/test";

const stamp = Date.now();
const login = `player${stamp}`;
const password = "senha123";

test("cadastro, busca Scryfall, deck e coleção", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  await page.goto("/buscar");
  await page.getByLabel("Buscar carta").fill("viol");
  await expect(page.getByRole("button").filter({ hasText: /violence/i }).first()).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByPlaceholder("1 Lightning Bolt").fill("1 Lightning Bolt");
  await page.getByRole("button", { name: "Importar lista" }).click();
  await expect(page.getByText("Lightning Bolt").first()).toBeVisible();

  await page.goto("/decks");
  await page.getByLabel("Nome do deck").fill("V1 Azorius");
  await page.getByLabel("Formato").selectOption("modern");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/decks\/[^/]+\/edit$/);

  await page.getByRole("button", { name: "Busca", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar lista" }).click();
  await page.getByLabel("Lista no deck").fill("1 Sol Ring");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const deckId = page.url().split("/decks/")[1].split("/")[0];
  const added = (await (await page.request.get(`/api/decks/${deckId}`)).json()) as {
    cards: { name_en: string; name_pt: string | null }[];
  };
  const ring = added.cards.find((item) => item.name_en === "Sol Ring");
  await expect(page.getByText(ring?.name_pt ?? "Sol Ring", { exact: true }).first()).toBeVisible();
  const addedRow = page.getByTestId("deck-card-text").first();
  await addedRow.hover();
  await expect(addedRow.getByRole("button", { name: /Opções de / })).toBeVisible();

  await page.getByRole("button", { name: "Incluir na coleção" }).click();
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByText(/enviadas à coleção|enviadas para a coleção/)).toBeVisible();

  await page.getByRole("button", { name: "Incluir na coleção" }).click();
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByText("Estas cartas já estão na coleção.")).toBeVisible();
  await page.getByRole("button", { name: "Prosseguir" }).click();
  await expect(page.getByText("Estas cartas já estão na coleção.")).toHaveCount(0);

  await page.goto("/colecao");
  await page.getByRole("link", { name: /Minha coleção/ }).click();
  await expect(page.getByText("Sol Ring").first()).toBeVisible();
});
