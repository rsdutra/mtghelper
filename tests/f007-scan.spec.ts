import { expect, test } from "@playwright/test";
import { cleanOcrText } from "../src/lib/ocr/clean";

test("F-007 limpa texto OCR", () => {
  expect(cleanOcrText("Lightning Bolt\nInstant")).toBe("Lightning Bolt");
  expect(cleanOcrText("  Violência  Gratuita  ")).toBe("Violência Gratuita");
  expect(cleanOcrText("Sol Ring ★")).toBe("Sol Ring");
});

test("F-007 abre o scanner na coleção e não no deck", async ({ page }) => {
  const stamp = Date.now();
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(`scan${stamp}`);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  await page.getByLabel("Nome do deck").fill("Scan Deck");
  await page.getByLabel("Formato").selectOption("modern");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/decks\/[^/]+\/edit$/);

  // F-004 / US-004-18: o escaneamento está pausado na edição do deck.
  await page.getByRole("button", { name: "Busca", exact: true }).click();
  await expect(page.getByRole("button", { name: "Adicionar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Escanear carta" })).toHaveCount(0);

  await page.goto("/colecao");
  await page.getByRole("link", { name: /Minha coleção/ }).click();
  await page.getByRole("button", { name: "Editar coleção" }).click();
  await page.getByRole("button", { name: "Escanear", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Escanear para a coleção" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Usar câmera" })).toBeVisible();
  await expect(page.getByText("Enviar imagem")).toBeVisible();
});
