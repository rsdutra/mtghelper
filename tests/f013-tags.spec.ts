import { expect, test, type Page } from "@playwright/test";

/** F-013 / US-013-01 / US-013-02 — tags no deck e na coleção. */
const stamp = Date.now();
const login = `tags${stamp}`;

/** F-019: as bolinhas de tag da view Texto dependem de “Tags” no Exibir. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("mtghelper.deck.textOptions")) localStorage.setItem("mtghelper.deck.textOptions", '["tags"]');
  });
});
const password = "senha123";

async function addDeckList(page: Page, text: string, nameEn: string) {
  if ((await page.getByRole("button", { name: "Adicionar lista" }).count()) === 0) {
    await page.getByRole("button", { name: "Busca", exact: true }).click();
  }
  await page.getByRole("button", { name: "Adicionar lista" }).click();
  await page.getByLabel("Lista no deck").fill(text);
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const deckId = page.url().split("/decks/")[1]?.split("/")[0];
  const response = await page.request.get(`/api/decks/${deckId}`);
  const data = (await response.json()) as { cards: { name_en: string; name_pt: string | null }[] };
  const card = data.cards.find((item) => item.name_en === nameEn);
  await expect(page.getByText(card?.name_pt ?? nameEn, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Busca", exact: true }).click();
}

async function createTag(page: Page, name: string) {
  await page.getByRole("menuitem", { name: "Nova tag…" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova tag" });
  await dialog.getByLabel("Nome", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Salvar" }).click();
}

test("deck e coleção marcam a carta com bolinha da tag", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  await page.getByLabel("Nome do deck").fill("Tags");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/decks\/[^/]+\/edit$/);

  await addDeckList(page, "1 Sol Ring", "Sol Ring");
  await addDeckList(page, "1 Lightning Bolt", "Lightning Bolt");

  const textView = page.getByTestId("deck-view-texto").first();
  const deckId = page.url().split("/decks/")[1].split("/")[0];
  const names = await page.request.get(`/api/decks/${deckId}`).then((response) => response.json()) as {
    cards: { name_en: string; name_pt: string | null }[];
  };
  const ringName = names.cards.find((item) => item.name_en === "Sol Ring");
  const ringLabel = ringName?.name_pt ?? "Sol Ring";
  const ringRow = textView.locator("li").filter({ hasText: ringLabel });
  await ringRow.hover();
  await ringRow.getByRole("button", { name: `Opções de ${ringLabel}` }).click();
  await createTag(page, "Ramp");
  await expect(ringRow.getByTitle("Ramp")).toBeVisible();

  await page.getByLabel("Visualização").selectOption("grid");
  const boltTile = page
    .getByTestId("deck-view-grid")
    .first()
    .getByTestId("deck-card-tile")
    .filter({ has: page.getByRole("img", { name: /Raio|Lightning Bolt/ }) });
  const badge = boltTile.getByLabel(/Quantidade de /);
  await boltTile.hover();
  await boltTile.getByRole("button", { name: /Opções de / }).click();
  await page.getByRole("menuitem", { name: "Ramp" }).click();
  await expect(badge.getByTitle("Ramp")).toBeVisible();

  if ((await page.getByRole("menuitem", { name: "Nova tag…" }).count()) === 0) {
    await boltTile.hover();
    await boltTile.getByRole("button", { name: /Opções de / }).click();
  }
  await createTag(page, "Draw");
  await page.keyboard.press("Escape");
  await expect(badge.getByTitle("Draw")).toBeVisible();
  await expect(badge.getByTitle("Ramp")).toBeVisible();
  await expect(badge.getByTitle("Ramp")).toHaveCSS("background-color", "rgba(37, 99, 235, 0.7)");
  const tileBox = await boltTile.boundingBox();
  const badgeBox = await badge.boundingBox();
  expect(tileBox && badgeBox).toBeTruthy();
  if (tileBox && badgeBox) {
    const rightGap = tileBox.x + tileBox.width - (badgeBox.x + badgeBox.width);
    expect(badgeBox.x).toBeGreaterThan(tileBox.x);
    expect(rightGap).toBeGreaterThan(16);
    expect(rightGap).toBeLessThan(32);
  }

  if ((await page.getByRole("menuitem", { name: "Ramp" }).count()) === 0) {
    await boltTile.hover();
    await boltTile.getByRole("button", { name: /Opções de / }).click();
  }
  await page.getByRole("menuitem", { name: "Ramp" }).click();
  await page.keyboard.press("Escape");
  await expect(boltTile.getByTitle("Ramp")).toHaveCount(0);
  await expect(boltTile.getByTitle("Draw")).toBeVisible();

  await page.goto("/colecao");
  await page.getByRole("link", { name: /Minha coleção/ }).click();
  await page.getByRole("button", { name: "Editar coleção" }).click();
  await page.getByLabel("Lista para adicionar").fill("1 Sol Ring");
  await page.getByRole("button", { name: "Adicionar lista" }).click();
  const card = page.getByRole("article").filter({ hasText: "Sol Ring" });
  await expect(card).toBeVisible({ timeout: 60_000 });

  await card.getByRole("button", { name: /Tags de / }).click();
  await createTag(page, "Reserva");
  await expect(card.getByTitle("Reserva")).toBeVisible();

  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.locator("li").filter({ hasText: "Sol Ring" }).getByTitle("Reserva")).toBeVisible();

  await page.getByLabel("Buscar na coleção").fill("Reserva");
  await expect(page.locator("li").filter({ hasText: "Sol Ring" })).toBeVisible();
  await page.getByLabel("Buscar na coleção").fill("naoexiste");
  await expect(page.locator("li").filter({ hasText: "Sol Ring" })).toHaveCount(0);
});
