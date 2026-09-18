import { expect, test } from "@playwright/test";

const stamp = Date.now();
const login = `filtro${stamp}`;
const password = "senha123";

test("US-005-07 filtra somente a coleção atual", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  await page.goto("/colecao");
  await page.getByRole("link", { name: /Minha coleção/ }).click();
  await expect(page.getByRole("button", { name: "Filtros" })).toBeVisible();
  await expect(page.getByLabel("Query Scryfall")).toBeVisible();

  await page.getByRole("button", { name: "Editar coleção" }).click();
  await page.getByLabel("Lista para adicionar").fill("1 Lightning Bolt\n1 Counterspell\n1 Sol Ring\n1 Llanowar Elves");
  await page.getByRole("button", { name: "Adicionar lista" }).click();
  await expect(page.getByRole("article").filter({ hasText: "Lightning Bolt" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("article").filter({ hasText: "Llanowar Elves" })).toBeVisible();
  await page.getByRole("button", { name: "Editar coleção" }).click();

  await page.getByLabel("Tipo").selectOption("creature");
  await expect(page.getByRole("article").filter({ hasText: "Llanowar Elves" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Lightning Bolt" })).toHaveCount(0);
  await expect(page.getByText(/1 de 4 cartas/)).toBeVisible();

  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.getByLabel("Query Scryfall").fill("t:instant");
  await expect(page.getByRole("article").filter({ hasText: "Lightning Bolt" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Counterspell" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: "Sol Ring" })).toHaveCount(0);

  await page.getByLabel("Buscar na coleção").fill("bolt");
  await expect(page.getByRole("article").filter({ hasText: "Counterspell" })).toHaveCount(0);
  await expect(page.getByRole("article").filter({ hasText: "Lightning Bolt" })).toBeVisible();
});
