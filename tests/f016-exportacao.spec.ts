import { expect, test, type Page } from "@playwright/test";
import { deckExportOptions, formatDeckExportList, type DeckExportCard } from "../src/lib/deck-export";

/**
 * F-016 / US-016-01 — painel de exportação (Deck, Sideboard, Maybeboard, Tudo).
 * F-016 / US-016-02 — “Copiar nome” no menu da carta.
 */
const stamp = Date.now();

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

const sample: DeckExportCard[] = [
  { quantity: 4, place: "main", name_en: "Lightning Bolt" },
  { quantity: 2, place: "main", name_en: "Counterspell" },
  { quantity: 3, place: "side", name_en: "Pyroblast" },
  { quantity: 1, place: "out", name_en: "Shock" },
  { quantity: 1, place: "side", name_en: "Lightning Bolt" },
];

test("monta cada conjunto exportável", () => {
  expect(formatDeckExportList(sample, "main")).toBe("2 Counterspell\n4 Lightning Bolt");
  expect(formatDeckExportList(sample, "side")).toBe("1 Lightning Bolt\n3 Pyroblast");
  expect(formatDeckExportList(sample, "out")).toBe("1 Shock");
  expect(formatDeckExportList(sample, "all")).toBe(
    "2 Counterspell\n4 Lightning Bolt\n1 Lightning Bolt\n3 Pyroblast\n1 Shock",
  );

  // Sem sideboard no formato: sideboard entra no Deck e a opção some.
  expect(formatDeckExportList(sample, "main", false)).toBe(
    "2 Counterspell\n4 Lightning Bolt\n1 Lightning Bolt\n3 Pyroblast",
  );
  expect(formatDeckExportList(sample, "side", false)).toBe("");
  expect(deckExportOptions(true).map((option) => option.label)).toEqual(["Deck", "Sideboard", "Maybeboard", "Tudo"]);
  expect(deckExportOptions(false).map((option) => option.label)).toEqual(["Deck", "Maybeboard", "Tudo"]);
});

async function register(page: Page, login: string) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);
}

async function createDeck(page: Page, name: string, format: string, lists: Record<"main" | "side" | "out", string>) {
  const created = await page.request.post("/api/decks", { data: { name, format } });
  const { deck } = (await created.json()) as { deck: { id: string } };
  for (const [place, text] of Object.entries(lists)) {
    if (!text) continue;
    const added = await page.request.post(`/api/decks/${deck.id}/cards`, { data: { text, place } });
    expect(added.ok()).toBeTruthy();
  }
  return deck.id;
}

/** O clipboard do Windows devolve as quebras de linha como CRLF. */
async function clipboard(page: Page) {
  const text = await page.evaluate(() => navigator.clipboard.readText());
  return text.replace(/\r\n/g, "\n");
}

async function exportAndRead(page: Page, title: string) {
  await page.getByRole("button", { name: title, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  const area = dialog.getByLabel("Lista exportada");
  const text = (await area.count()) ? await area.inputValue() : "";
  if (text) {
    await expect(dialog.getByText("Copiado para a área de transferência.")).toBeVisible();
    expect(await clipboard(page)).toBe(text);
  }
  await dialog.getByRole("button", { name: "Fechar" }).click();
  await expect(dialog).toHaveCount(0);
  return text;
}

test("exporta cada lista pelo painel à direita", async ({ page }) => {
  await register(page, `export${stamp}`);
  const deckId = await createDeck(page, "Exportar Modern", "modern", {
    main: "4 Lightning Bolt\n2 Mountain",
    side: "3 Pyroblast",
    out: "1 Shock",
  });
  await page.goto(`/decks/${deckId}/edit`);
  await expect(page.getByTestId("deck-card-text").first()).toBeVisible();

  // Botão abaixo de “Ferramentas de construção”; o “Exportar” do cabeçalho saiu.
  const exportButton = page.getByRole("button", { name: "Exportar", exact: true });
  const buildTools = page.getByRole("button", { name: "Ferramentas de construção", exact: true });
  await expect(exportButton).toHaveCount(1);
  const exportBox = await exportButton.boundingBox();
  const toolsBox = await buildTools.boundingBox();
  expect(exportBox && toolsBox).toBeTruthy();
  if (exportBox && toolsBox) {
    expect(Math.abs(exportBox.x - toolsBox.x)).toBeLessThanOrEqual(1);
    expect(exportBox.y).toBeGreaterThan(toolsBox.y);
  }
  await expect(page.getByRole("menuitem", { name: /Exportar/ })).toHaveCount(0);

  await exportButton.click();
  await expect(exportButton).toHaveAttribute("aria-pressed", "true");
  const options = page.getByRole("list", { name: "Opções de exportação" });
  await expect(options.getByRole("button")).toHaveText(["Deck", "Sideboard", "Maybeboard", "Tudo"]);

  expect(await exportAndRead(page, "Exportar deck")).toBe("4 Lightning Bolt\n2 Mountain");
  expect(await exportAndRead(page, "Exportar sideboard")).toBe("3 Pyroblast");
  expect(await exportAndRead(page, "Exportar maybeboard")).toBe("1 Shock");
  expect(await exportAndRead(page, "Exportar tudo")).toBe("4 Lightning Bolt\n2 Mountain\n3 Pyroblast\n1 Shock");

  await exportButton.click();
  await expect(options).toHaveCount(0);

  // Visualização: mesmo painel.
  await page.goto(`/decks/${deckId}`);
  await expect(page.getByTestId("deck-card-text").first()).toBeVisible();
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  expect(await exportAndRead(page, "Exportar deck")).toBe("4 Lightning Bolt\n2 Mountain");

  // Formato sem sideboard: sem a opção Sideboard; Maybeboard vazio avisa.
  const commanderId = await createDeck(page, "Exportar Commander", "commander", { main: "1 Sol Ring", side: "", out: "" });
  await page.goto(`/decks/${commanderId}`);
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  await expect(page.getByRole("list", { name: "Opções de exportação" }).getByRole("button")).toHaveText([
    "Deck",
    "Maybeboard",
    "Tudo",
  ]);
  await page.getByRole("button", { name: "Exportar maybeboard", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Nenhuma carta para exportar.")).toBeVisible();
});

test("copia o nome em inglês pelo menu da carta", async ({ page }) => {
  await register(page, `copyname${stamp}`);
  const deckId = await createDeck(page, "Copiar nome", "modern", { main: "4 Lightning Bolt", side: "", out: "" });
  const data = (await (await page.request.get(`/api/decks/${deckId}`)).json()) as {
    cards: { name_en: string; name_pt: string | null }[];
  };
  const label = data.cards[0].name_pt ?? data.cards[0].name_en;

  await page.goto(`/decks/${deckId}/edit`);
  const viewSelect = page.getByLabel("Visualização");

  // Lista em texto: “Copiar nome” no menu de opções da linha (F-017).
  await viewSelect.selectOption("texto");
  const row = page.getByTestId("deck-view-texto").first().locator("li").filter({ hasText: label });
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await row.hover();
  await row.getByRole("button", { name: `Opções de ${label}` }).click();
  const editMenu = page.getByRole("menu");
  await editMenu.getByRole("menuitem", { name: "Copiar nome" }).click();
  await expect(editMenu.getByRole("status")).toHaveText("Nome copiado");
  expect(await clipboard(page)).toBe("Lightning Bolt");
  await expect(editMenu.getByRole("status")).toHaveCount(0, { timeout: 5000 });

  // Grid: item do menu de três pontos.
  await viewSelect.selectOption("grid");
  const tile = page.getByTestId("deck-card-tile").first();
  await tile.hover();
  await tile.getByRole("button", { name: `Opções de ${label}` }).click();
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await tile.getByRole("menuitem", { name: "Copiar nome" }).click();
  await expect(tile.getByRole("status")).toHaveText("Nome copiado");
  expect(await clipboard(page)).toBe("Lightning Bolt");

  // Visualização, texto: três pontos no fim da linha, só ao pairar, com o menu só de “Copiar nome”.
  await page.goto(`/decks/${deckId}`);
  await viewSelect.selectOption("texto");
  const compactRow = page.getByTestId("deck-card-text").filter({ hasText: label });
  const rowOptions = compactRow.getByRole("button", { name: `Opções de ${label}` });
  await page.mouse.move(5, 5);
  await expect(rowOptions).toBeHidden();
  await compactRow.hover();
  await expect(rowOptions).toBeVisible();
  await rowOptions.click();
  const viewMenu = page.getByTestId("deck-card-actions");
  await expect(viewMenu.getByRole("menuitem")).toHaveText(["Copiar nome"]);
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await viewMenu.getByRole("menuitem", { name: "Copiar nome" }).click();
  await expect(viewMenu.getByRole("status")).toHaveText("Nome copiado");
  expect(await clipboard(page)).toBe("Lightning Bolt");
  await page.mouse.click(5, 5);
  await expect(viewMenu).toHaveCount(0);
  await expect(rowOptions).toBeHidden();
  await expect(page.getByRole("button", { name: `Copiar nome de ${label}` })).toHaveCount(0);

  // Visualização, grid: mesmo menu, só com “Copiar nome”.
  await viewSelect.selectOption("grid");
  const viewTile = page.getByTestId("deck-card-tile").first();
  await viewTile.hover();
  await viewTile.getByRole("button", { name: `Opções de ${label}` }).click();
  await expect(viewTile.getByTestId("deck-card-actions").getByRole("menuitem")).toHaveText(["Copiar nome"]);
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await viewTile.getByRole("menuitem", { name: "Copiar nome" }).click();
  expect(await clipboard(page)).toBe("Lightning Bolt");
});
