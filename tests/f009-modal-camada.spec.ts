import { expect, test, type Locator, type Page } from "@playwright/test";

/** F-009 / US-009-04 — modal aberta fica por cima de qualquer painel, na ordem que for. */
const stamp = Date.now();

/** Quantos pontos (cantos e centro da caixa da modal) estão cobertos por outro elemento. */
async function coveredPoints(dialog: Locator) {
  return dialog.evaluate((overlay) => {
    const box = (overlay.firstElementChild as HTMLElement).getBoundingClientRect();
    const points: Array<[number, number]> = [
      [box.left + 8, box.top + 8],
      [box.right - 8, box.top + 8],
      [box.right - 8, box.bottom - 8],
      [box.left + 8, box.bottom - 8],
      [box.left + box.width / 2, box.top + box.height / 2],
    ];
    return points.filter(([x, y]) => {
      const element = document.elementFromPoint(x, y);
      return !element || !overlay.contains(element);
    }).length;
  });
}

async function openPanel(page: Page, label: string) {
  const button = page.getByRole("button", { name: label, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

test("modais ficam por cima dos painéis abertos do deck", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(`modalcamada${stamp}`);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  const created = await page.request.post("/api/decks", { data: { name: "Camadas", format: "modern" } });
  const { deck } = (await created.json()) as { deck: { id: string } };
  const added = await page.request.post(`/api/decks/${deck.id}/cards`, {
    data: { text: "4 Lightning Bolt\n4 Mountain", place: "main" },
  });
  expect(added.ok()).toBeTruthy();
  await page.goto(`/decks/${deck.id}/edit`);

  // Um painel por vez: abrir outro fecha o anterior.
  await openPanel(page, "Ferramentas de construção");
  await openPanel(page, "Gráficos");
  await openPanel(page, "Tags");
  await openPanel(page, "Busca");
  for (const label of ["Ferramentas de construção", "Gráficos", "Tags"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "false");
  }

  // A modal nasce dentro do painel de Busca e mesmo assim cobre o painel e a coluna de botões.
  await page.getByRole("button", { name: "Adicionar lista" }).click();
  const listDialog = page.getByRole("dialog", { name: "Adicionar lista" });
  await expect(listDialog).toBeVisible();
  expect(await coveredPoints(listDialog)).toBe(0);
  await listDialog.getByLabel("Lista no deck").fill("1 Shock");
  await listDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(listDialog).toHaveCount(0);
  const shock = (await (await page.request.get(`/api/decks/${deck.id}`)).json()) as {
    cards: { name_en: string; name_pt: string | null }[];
  };
  const shockName = shock.cards.find((item) => item.name_en === "Shock")?.name_pt ?? "Shock";
  await expect(page.getByText(shockName, { exact: true }).first()).toBeVisible();

  // Modal de exportar (F-016): abrir Exportar fecha a Busca.
  await openPanel(page, "Exportar");
  await expect(page.getByRole("button", { name: "Busca", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Exportar tudo" }).click();
  const exportDialog = page.getByRole("dialog");
  await expect(exportDialog).toBeVisible();
  expect(await coveredPoints(exportDialog)).toBe(0);
  await exportDialog.getByRole("button", { name: "Fechar" }).click();
  await expect(exportDialog).toHaveCount(0);
});
