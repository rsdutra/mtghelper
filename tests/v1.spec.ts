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

  await page.getByPlaceholder("1 Sol Ring").fill("1 Sol Ring");
  await page.getByRole("button", { name: "Adicionar ao deck" }).click();
  await expect(page.getByText("Sol Ring").first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "No deck", exact: true }).first()).toBeChecked();

  await page.getByLabel("Nome da seção").fill("upgrade");
  await page.getByRole("button", { name: "Criar seção" }).click();
  await expect(page.getByLabel("Seção destino")).toContainText("upgrade");

  await page.getByRole("checkbox", { name: /Incluir na coleção/ }).check();
  await page.getByRole("button", { name: "Processar" }).click();
  await expect(page.getByText(/enviadas à coleção|enviadas para a coleção/)).toBeVisible();

  await page.goto("/colecao");
  await page.getByRole("link", { name: /Minha coleção/ }).click();
  await expect(page.getByText("Sol Ring").first()).toBeVisible();
});
