import { expect, test, type Page } from "@playwright/test";

/** F-010 — Tipos de visualização do deck (Texto, Grid visual, Grid visual agrupada). */
const stamp = Date.now();
const login = `views${stamp}`;
const password = "senha123";

type DeckCard = { id: string; name_en: string; name_pt: string | null; quantity: number; place: string };

async function cardLabels(page: Page, deckId: string) {
  const response = await page.request.get(`/api/decks/${deckId}`);
  const data = (await response.json()) as { cards: DeckCard[] };
  const label = (nameEn: string) => {
    const card = data.cards.find((item) => item.name_en === nameEn);
    if (!card) throw new Error(`carta ${nameEn} não está no deck`);
    return card.name_pt ?? card.name_en;
  };
  return { bolt: label("Lightning Bolt"), ring: label("Sol Ring"), island: label("Island") };
}

async function addToDeck(page: Page, text: string, nameEn: string) {
  if ((await page.getByRole("button", { name: "Adicionar lista" }).count()) === 0) {
    await page.getByRole("button", { name: "Busca", exact: true }).click();
  }
  await page.getByRole("button", { name: "Adicionar lista" }).click();
  await page.getByLabel("Lista no deck").fill(text);
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nameEn).first()).toBeVisible();
  await page.getByRole("button", { name: "Busca", exact: true }).click();
}

test("visualizações: texto, grid visual e grid visual agrupada", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  await page.getByLabel("Nome do deck").fill("Views Test");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/decks\/[^/]+\/edit$/);
  const deckId = page.url().split("/decks/")[1].split("/")[0];

  await addToDeck(page, "1 Sol Ring", "Sol Ring");
  await addToDeck(page, "3 Lightning Bolt", "Lightning Bolt");
  await addToDeck(page, "1 Island", "Island");
  const names = await cardLabels(page, deckId);

  // Texto é o default, com miniatura na edição.
  const viewSelect = page.getByLabel("Visualização");
  await expect(viewSelect).toHaveValue("texto");
  const textView = page.getByTestId("deck-view-texto").first();
  await expect(textView.locator("img")).toHaveCount(3);

  // Island vai para "Fora do deck" pelo seletor da linha.
  const islandRow = textView.locator("li").filter({ hasText: "Island" });
  await islandRow.getByLabel(`Mover ${names.island}`).selectOption("out");
  await expect(page.getByTestId("deck-view-texto")).toHaveCount(2);

  // US-010-05: preview só ao pairar sobre o texto.
  const preview = page.getByTestId("card-hover-preview");
  await textView.getByTestId("deck-card-text").filter({ hasText: names.bolt }).hover();
  await expect(preview).toBeVisible();
  await expect(preview.locator("img")).toHaveAttribute("alt", names.bolt);
  await page.mouse.move(5, 5);
  await expect(preview).toHaveCount(0);

  // US-010-03: Grid visual com selo de quantidade e linhas sobrepostas pela metade.
  await viewSelect.selectOption("grid");
  const gridView = page.getByTestId("deck-view-grid").first();
  await expect(gridView.getByTestId("deck-card-tile")).toHaveCount(2);
  await expect(page.getByTestId("deck-view-grid").nth(1).getByTestId("deck-card-tile")).toHaveCount(1);
  const badge = gridView.getByLabel(`Quantidade de ${names.bolt}`);
  await expect(badge).toHaveText("x3");
  const tile = gridView.getByTestId("deck-card-tile").first();
  const boltTileBox = await gridView.getByTestId("deck-card-tile").filter({ has: page.getByAltText(names.bolt) }).boundingBox();
  const badgeBox = await badge.boundingBox();
  expect(boltTileBox && badgeBox).toBeTruthy();
  if (boltTileBox && badgeBox) {
    const rightGap = boltTileBox.x + boltTileBox.width - (badgeBox.x + badgeBox.width);
    expect(badgeBox.x).toBeGreaterThan(boltTileBox.x);
    expect(rightGap).toBeGreaterThan(16);
    expect(rightGap).toBeLessThan(32);
    expect(badgeBox.y).toBeGreaterThan(boltTileBox.y + 30);
  }
  const tileHeight = (await tile.boundingBox())?.height ?? 0;
  const rowHeight = await tile.evaluate((element) => parseFloat(getComputedStyle(element.parentElement!).gridAutoRows));
  expect(Math.abs(rowHeight - tileHeight / 2)).toBeLessThanOrEqual(1);

  const boltTile = gridView.getByTestId("deck-card-tile").filter({ has: page.getByAltText(names.bolt) });
  await boltTile.getByRole("img", { name: names.bolt }).hover();
  await expect(preview).toBeVisible();
  await boltTile.hover();
  const options = boltTile.getByRole("button", { name: `Opções de ${names.bolt}` });
  await options.click();
  await expect(preview).toHaveCount(0);
  await boltTile.getByRole("menuitem", { name: "Aumentar" }).click();
  await expect(gridView.getByLabel(`Quantidade de ${names.bolt}`)).toHaveText("x4");

  // Agrupar por tipo vale para a grid (grupos recolhíveis).
  await page.getByRole("checkbox", { name: /Agrupar por tipo/ }).check();
  await expect(page.getByRole("button", { name: /Instantâneos/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Artefatos/ })).toBeVisible();

  // US-010-04: Grid visual agrupada = uma pilha por grupo, cartas deslocadas só pela faixa do título.
  await viewSelect.selectOption("pilhas");
  const stacksView = page.getByTestId("deck-view-pilhas").first();
  await expect(stacksView.getByTestId("deck-card-stack")).toHaveCount(2);
  await page.getByRole("button", { name: /Artefatos/ }).click();
  await expect(stacksView.getByTestId("deck-card-stack")).toHaveCount(1);
  await page.getByRole("button", { name: /Artefatos/ }).click();
  await expect(stacksView.getByTestId("deck-card-stack")).toHaveCount(2);

  const instantStack = stacksView
    .getByTestId("deck-card-stack")
    .filter({ has: page.getByAltText(names.bolt) });
  await instantStack.getByRole("img", { name: names.bolt }).hover();
  await instantStack.getByRole("button", { name: `Opções de ${names.bolt}` }).click();
  await expect(instantStack.getByTestId("deck-card-actions")).toBeVisible();
  const stackBadge = instantStack.getByLabel(`Quantidade de ${names.bolt}`);
  await expect(stackBadge).toHaveText("x4");
  const stackImg = await instantStack.getByRole("img", { name: names.bolt }).boundingBox();
  const stackBadgeBox = await stackBadge.boundingBox();
  const stackMenu = await instantStack.getByRole("button", { name: `Opções de ${names.bolt}` }).boundingBox();
  expect(stackImg && stackBadgeBox && stackMenu).toBeTruthy();
  if (stackImg && stackBadgeBox && stackMenu) {
    expect(stackBadgeBox.x).toBeLessThan(stackImg.x);
    expect(stackBadgeBox.y).toBeLessThan(stackImg.y);
    expect(stackMenu.x).toBeGreaterThan(stackImg.x);
    expect(stackMenu.y).toBeGreaterThan(stackImg.y);
  }

  // Preferência persiste após recarregar.
  await page.reload();
  await expect(page.getByLabel("Visualização")).toHaveValue("pilhas");

  // Sem agrupamento: pilhas de até 12 cartas; a pilha mostra o título de cada carta.
  await page.getByRole("checkbox", { name: /Agrupar por tipo/ }).uncheck();
  const ungrouped = page.getByTestId("deck-view-pilhas").first();
  await expect(ungrouped.getByTestId("deck-card-stack")).toHaveCount(1);
  const tiles = ungrouped.getByTestId("deck-card-tile");
  await expect(tiles).toHaveCount(2);
  const first = await tiles.nth(0).boundingBox();
  const second = await tiles.nth(1).boundingBox();
  expect(Math.round((second?.y ?? 0) - (first?.y ?? 0))).toBe(44);
  await expect(page.getByTestId("deck-view-pilhas").nth(1).getByTestId("deck-card-stack")).toHaveCount(1);
});
