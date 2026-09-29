import { expect, test, type Page } from "@playwright/test";

/** F-013 / US-013-05 — agrupar a lista “No deck” por tag, com Multitag e Sem tag. */
const stamp = Date.now();

type DeckCard = { name_en: string; name_pt: string | null };

async function cardLabel(page: Page, deckId: string, nameEn: string) {
  const response = await page.request.get(`/api/decks/${deckId}`);
  const data = (await response.json()) as { cards: DeckCard[] };
  const card = data.cards.find((item) => item.name_en === nameEn);
  if (!card) throw new Error(`carta ${nameEn} não está no deck`);
  return card.name_pt ?? card.name_en;
}

async function addDeckList(page: Page, text: string, nameEn: string) {
  if ((await page.getByRole("button", { name: "Adicionar lista" }).count()) === 0) {
    await page.getByRole("button", { name: "Busca", exact: true }).click();
  }
  await page.getByRole("button", { name: "Adicionar lista" }).click();
  await page.getByLabel("Lista no deck").fill(text);
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(nameEn).first()).toBeVisible();
  await page.getByRole("button", { name: "Busca", exact: true }).click();
}

function cardRow(page: Page, label: string) {
  return page.getByTestId("deck-view-texto").first().locator("li").filter({ hasText: label });
}

async function openTagMenu(page: Page, label: string) {
  const row = cardRow(page, label);
  if ((await row.getByRole("menuitem", { name: "Nova tag…" }).count()) === 0) {
    await row.getByRole("button", { name: /Tags de / }).click();
  }
}

async function newTag(page: Page, label: string, tag: string, color: string) {
  await openTagMenu(page, label);
  await cardRow(page, label).getByRole("menuitem", { name: "Nova tag…" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova tag" });
  await dialog.getByLabel("Nome", { exact: true }).fill(tag);
  await dialog.getByLabel("Cor", { exact: true }).fill(color);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(cardRow(page, label).getByTitle(tag).first()).toBeVisible();
}

async function existingTag(page: Page, label: string, tag: string) {
  await openTagMenu(page, label);
  await cardRow(page, label).getByRole("menuitem", { name: tag }).click();
  await expect(cardRow(page, label).locator("span[aria-label]").getByTitle(tag)).toBeVisible();
  await page.mouse.click(5, 5);
}

/** Grupos da view Texto na edição: `div` com cabeçalho `button[aria-expanded]` e a lista. */
function editGroup(page: Page, name: string) {
  return page
    .getByTestId("deck-view-texto")
    .first()
    .locator(":scope > div")
    .filter({ has: page.locator("button[aria-expanded]", { hasText: name }) });
}

async function editGroupHeaders(page: Page) {
  const headers = page.getByTestId("deck-view-texto").first().locator(":scope > div > button[aria-expanded]");
  return (await headers.allTextContents()).map((text) => text.replace(/[▸▾\d]/g, "").trim());
}

test("agrupa por tag com Multitag e Sem tag", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(`agrupartag${stamp}`);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  await page.getByLabel("Nome do deck").fill("Agrupar por tag");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/decks\/[^/]+\/edit$/);
  const deckId = page.url().split("/decks/")[1].split("/")[0];

  await addDeckList(page, "1 Sol Ring", "Sol Ring");
  await addDeckList(page, "1 Lightning Bolt", "Lightning Bolt");
  await addDeckList(page, "1 Island", "Island");
  const ring = await cardLabel(page, deckId, "Sol Ring");
  const bolt = await cardLabel(page, deckId, "Lightning Bolt");
  const island = await cardLabel(page, deckId, "Island");

  await newTag(page, ring, "Ramp", "#16a34a");
  await existingTag(page, bolt, "Ramp");
  await newTag(page, bolt, "Remoção", "#dc2626");

  const byType = page.getByRole("checkbox", { name: "Agrupar por tipo" });
  const byTag = page.getByRole("checkbox", { name: "Agrupar por tag" });
  await byType.check();
  await byTag.check();
  await expect(byType).not.toBeChecked();

  // Um grupo por tag, depois Multitag e Sem tag.
  await expect.poll(() => editGroupHeaders(page)).toEqual(["Ramp", "Multitag", "Sem tag"]);
  const rampGroup = editGroup(page, "Ramp");
  await expect(rampGroup.getByText(ring, { exact: true })).toBeVisible();
  await expect(rampGroup.getByText(bolt, { exact: true })).toHaveCount(0);
  await expect(rampGroup.getByTestId("group-tag-dot")).toHaveCSS("background-color", "rgb(22, 163, 74)");
  const multiGroup = editGroup(page, "Multitag");
  await expect(multiGroup.getByText(bolt, { exact: true })).toBeVisible();
  await expect(multiGroup.getByTestId("group-tag-dot")).toHaveCount(0);
  await expect(editGroup(page, "Sem tag").getByText(island, { exact: true })).toBeVisible();

  // Recolher um grupo esconde as cartas dele.
  const multiHeader = multiGroup.locator(":scope > button[aria-expanded]");
  await multiHeader.click();
  await expect(multiGroup.getByText(bolt, { exact: true })).toHaveCount(0);
  await multiHeader.click();

  // Junto com o filtro por tag.
  await page.getByRole("button", { name: "Tags", exact: true }).click();
  await page.getByRole("list", { name: "Tags do deck" }).getByRole("button", { name: "Remoção", exact: true }).click();
  await expect.poll(() => editGroupHeaders(page)).toEqual(["Multitag"]);
  await page.getByRole("button", { name: "Limpar filtro" }).click();
  await page.getByRole("button", { name: "Tags", exact: true }).click();

  // Preferência salva no navegador.
  await page.reload();
  await expect(byTag).toBeChecked();
  await expect.poll(() => editGroupHeaders(page)).toEqual(["Ramp", "Multitag", "Sem tag"]);

  // Visualização: grupos no Texto em colunas.
  await page.getByRole("link", { name: "Concluir edição" }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deckId}$`));
  await expect(byTag).toBeChecked();
  const textView = page.getByTestId("deck-view-texto").first();
  await expect(textView.getByRole("button", { name: /Multitag/ })).toBeVisible();
  await expect(textView.getByRole("button", { name: /Sem tag/ })).toBeVisible();
  await expect(textView.getByTestId("group-tag-dot")).toHaveCount(1);

  await page.getByRole("checkbox", { name: "Agrupar por custo" }).check();
  await expect(byTag).not.toBeChecked();
});
