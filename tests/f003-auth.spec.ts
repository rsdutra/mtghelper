import { expect, test, type Page } from "@playwright/test";

/** F-003 — cadastro, login e logout caem na página certa, mesmo com prefetch do header (build de produção). */
const stamp = Date.now();
const login = `auth${stamp}`;
const password = "senha123";

async function fillLogin(page: Page, user: string, pass: string) {
  await page.getByLabel("Login").fill(user);
  await page.getByLabel("Senha").fill(pass);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("cadastro, logout e login redirecionam já com a sessão certa", async ({ page }) => {
  // US-003-01: o header pré-carrega /decks sem sessão; após cadastrar, /decks abre autenticado.
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks$/);
  await expect(page.getByLabel("Nome do deck")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toBeVisible();

  // US-003-02: sair volta para a home sem sessão; /decks pré-carregado com sessão não é reaproveitado.
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Decks", exact: true }).click();
  await expect(page).toHaveURL(/\/entrar\?next=%2Fdecks$/);

  // Senha errada mostra o erro e mantém o login digitado.
  await fillLogin(page, login, "errada");
  await expect(page.getByText("Login ou senha inválidos.")).toBeVisible();
  await expect(page.getByLabel("Login")).toHaveValue(login);

  // US-003-03: `next` leva ao destino após o login.
  await fillLogin(page, login, password);
  await expect(page).toHaveURL(/\/decks$/);
  await expect(page.getByLabel("Nome do deck")).toBeVisible();

  // `next` externo é ignorado.
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
  await page.goto("/entrar?next=//example.com");
  await fillLogin(page, login, password);
  await expect(page).toHaveURL(/localhost:3000\/decks$/);
});
