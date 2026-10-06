import { expect, test, type Page } from "@playwright/test";

/**
 * F-013 / US-013-03 — filtrar o deck por tag, na edição e na visualização.
 * F-013 / US-013-04 — renomear e excluir a tag pelo painel.
 */
const stamp = Date.now();

/** F-019: as bolinhas de tag da view Texto dependem de “Tags” no Exibir. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("mtghelper.deck.textOptions")) localStorage.setItem("mtghelper.deck.textOptions", '["tags"]');
  });
});
const password = "senha123";

type DeckCard = { name_en: string; name_pt: string | null; tags: { name: string; color: string }[] };

async function newDeck(page: Page, login: string, deckName: string) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  await page.getByLabel("Nome do deck").fill(deckName);
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/decks\/[^/]+\/edit$/);
  return page.url().split("/decks/")[1].split("/")[0];
}

async function deckCard(page: Page, deckId: string, nameEn: string) {
  const response = await page.request.get(`/api/decks/${deckId}`);
  const data = (await response.json()) as { cards: DeckCard[] };
  return data.cards.find((item) => item.name_en === nameEn) ?? null;
}

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
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const deckId = page.url().split("/decks/")[1]?.split("/")[0];
  const label = await cardLabel(page, deckId, nameEn);
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Busca", exact: true }).click();
}

async function tagCard(page: Page, label: string, tag: string, color: string) {
  const row = page.getByTestId("deck-view-texto").first().locator("li").filter({ hasText: label });
  await row.hover();
  await row.getByRole("button", { name: /Opções de / }).click();
  await page.getByRole("menuitem", { name: "Nova tag…" }).click();
  const dialog = page.getByRole("dialog", { name: "Nova tag" });
  await dialog.getByLabel("Nome", { exact: true }).fill(tag);
  await dialog.getByLabel("Cor", { exact: true }).fill(color);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(row.getByTitle(tag)).toBeVisible();
  await page.keyboard.press("Escape");
}

async function expectShown(page: Page, shown: string[], hidden: string[]) {
  const textView = page.getByTestId("deck-view-texto").first();
  for (const label of shown) await expect(textView.getByText(label, { exact: true }).first()).toBeVisible();
  for (const label of hidden) await expect(textView.getByText(label, { exact: true })).toHaveCount(0);
}

test("filtra o deck por tag e limpa o filtro", async ({ page }) => {
  const deckId = await newDeck(page, `tagfilter${stamp}`, "Filtro de tags");

  const tagsButton = page.getByRole("button", { name: "Tags", exact: true });
  const chartsButton = page.getByRole("button", { name: "Gráficos", exact: true });

  // Botão “Tags” logo abaixo de “Gráficos”.
  const chartsBox = (await chartsButton.boundingBox())!;
  const tagsBox = (await tagsButton.boundingBox())!;
  expect(Math.abs(tagsBox.x - chartsBox.x)).toBeLessThanOrEqual(1);
  expect(tagsBox.y).toBeGreaterThan(chartsBox.y + chartsBox.height - 1);
  expect(tagsBox.y - (chartsBox.y + chartsBox.height)).toBeLessThanOrEqual(16);

  // Deck sem tags: aviso no painel.
  await tagsButton.click();
  await expect(page.getByText("Nenhuma tag neste deck.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Limpar filtro" })).toBeDisabled();
  await tagsButton.click();

  await addDeckList(page, "1 Sol Ring", "Sol Ring");
  await addDeckList(page, "1 Lightning Bolt", "Lightning Bolt");
  await addDeckList(page, "1 Island", "Island");
  const ring = await cardLabel(page, deckId, "Sol Ring");
  const bolt = await cardLabel(page, deckId, "Lightning Bolt");
  const island = await cardLabel(page, deckId, "Island");

  await tagCard(page, ring, "Ramp", "#16a34a");
  await tagCard(page, bolt, "Remoção", "#dc2626");

  // Painel lista as tags com a cor.
  await tagsButton.click();
  const tagList = page.getByRole("list", { name: "Tags do deck" });
  await expect(tagList.locator("li")).toHaveCount(2);
  const rampButton = tagList.getByRole("button", { name: "Ramp", exact: true });
  const removalButton = tagList.getByRole("button", { name: "Remoção", exact: true });
  await expect(rampButton.locator("span[aria-hidden]")).toHaveCSS("background-color", "rgb(22, 163, 74)");
  await expect(removalButton.locator("span[aria-hidden]")).toHaveCSS("background-color", "rgb(220, 38, 38)");

  // Clicar na tag filtra; outra tag troca o filtro.
  await rampButton.click();
  await expect(rampButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("deck-tag-filter-active")).toHaveText(/Ramp/);
  await expectShown(page, [ring], [bolt, island]);

  await removalButton.click();
  await expect(rampButton).toHaveAttribute("aria-pressed", "false");
  await expectShown(page, [bolt], [ring, island]);

  // Limpar filtro volta a mostrar tudo.
  await page.getByRole("button", { name: "Limpar filtro" }).click();
  await expect(page.getByTestId("deck-tag-filter-active")).toHaveCount(0);
  await expectShown(page, [ring, bolt, island], []);

  // Clicar na tag ativa desliga o filtro.
  await rampButton.click();
  await expectShown(page, [ring], [bolt, island]);
  await rampButton.click();
  await expectShown(page, [ring, bolt, island], []);
  await tagsButton.click();

  // Visualização: mesma coluna, sem “Busca”; “Gráficos” também aparece (US-011-06).
  await page.getByRole("link", { name: "Concluir edição" }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deckId}$`));
  await expect(chartsButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Busca", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Canvas", exact: true })).toBeVisible();
  await tagsButton.click();
  await expect(page.getByRole("button", { name: /^(Editar|Excluir) tag / })).toHaveCount(0);
  await page.getByRole("list", { name: "Tags do deck" }).getByRole("button", { name: "Remoção", exact: true }).click();
  await expectShown(page, [bolt], [ring, island]);
  await page.getByRole("button", { name: "Limpar filtro" }).click();
  await expectShown(page, [ring, bolt, island], []);
  await tagsButton.click();
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deckId}\\?view=canvas$`));
});

test("renomeia e exclui a tag pelo painel de filtro", async ({ page }) => {
  const deckId = await newDeck(page, `tagedit${stamp}`, "Editar tags");
  await addDeckList(page, "1 Sol Ring", "Sol Ring");
  await addDeckList(page, "1 Lightning Bolt", "Lightning Bolt");
  const ring = await cardLabel(page, deckId, "Sol Ring");
  const bolt = await cardLabel(page, deckId, "Lightning Bolt");
  await tagCard(page, ring, "Ramp", "#16a34a");
  await tagCard(page, bolt, "Remoção", "#dc2626");

  await page.getByRole("button", { name: "Tags", exact: true }).click();
  const tagList = page.getByRole("list", { name: "Tags do deck" });
  await tagList.getByRole("button", { name: "Ramp", exact: true }).click();
  await expectShown(page, [ring], [bolt]);

  // Ícones à esquerda do nome da tag.
  const rampRow = tagList.locator("li").filter({ hasText: "Ramp" });
  const editBox = (await rampRow.getByRole("button", { name: "Editar tag Ramp" }).boundingBox())!;
  const deleteBox = (await rampRow.getByRole("button", { name: "Excluir tag Ramp" }).boundingBox())!;
  const nameBox = (await rampRow.getByRole("button", { name: "Ramp", exact: true }).boundingBox())!;
  expect(editBox.x).toBeLessThan(deleteBox.x);
  expect(deleteBox.x).toBeLessThan(nameBox.x);

  // Editar: nome repetido é bloqueado; nome e cor novos valem em todas as cartas.
  await rampRow.getByRole("button", { name: "Editar tag Ramp" }).click();
  const editDialog = page.getByRole("dialog", { name: "Editar tag" });
  await expect(editDialog.getByLabel("Nome", { exact: true })).toHaveValue("Ramp");
  await editDialog.getByLabel("Nome", { exact: true }).fill("remoção");
  await editDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(editDialog.getByText("Já existe uma tag com esse nome.")).toBeVisible();  await editDialog.getByLabel("Nome", { exact: true }).fill("Aceleração");
  await editDialog.getByLabel("Cor", { exact: true }).fill("#9333ea");
  await editDialog.getByRole("button", { name: "Salvar" }).click();
  await expect(editDialog).toHaveCount(0);

  const renamed = tagList.getByRole("button", { name: "Aceleração", exact: true });
  await expect(renamed).toHaveAttribute("aria-pressed", "true");
  await expect(renamed.locator("span[aria-hidden]")).toHaveCSS("background-color", "rgb(147, 51, 234)");
  await expect(tagList.getByRole("button", { name: "Ramp", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("deck-tag-filter-active")).toHaveText(/Aceleração/);
  await expectShown(page, [ring], [bolt]);
  expect((await deckCard(page, deckId, "Sol Ring"))?.tags).toEqual([{ name: "Aceleração", color: "#9333ea" }]);

  // Excluir: cancelar não muda nada; confirmar tira a tag e desliga o filtro.
  await tagList.getByRole("button", { name: "Excluir tag Aceleração" }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Excluir tag" });
  await expect(deleteDialog).toContainText("Aceleração");  await deleteDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(deleteDialog).toHaveCount(0);
  await expect(renamed).toBeVisible();

  await tagList.getByRole("button", { name: "Excluir tag Aceleração" }).click();
  await deleteDialog.getByRole("button", { name: "Excluir" }).click();
  await expect(deleteDialog).toHaveCount(0);
  await expect(renamed).toHaveCount(0);
  await expect(tagList.getByRole("button", { name: "Remoção", exact: true })).toBeVisible();
  await expect(page.getByTestId("deck-tag-filter-active")).toHaveCount(0);
  await expectShown(page, [ring, bolt], []);
  const ringAfter = await deckCard(page, deckId, "Sol Ring");
  expect(ringAfter).not.toBeNull();
  expect(ringAfter?.tags).toEqual([]);
  expect((await deckCard(page, deckId, "Lightning Bolt"))?.tags).toEqual([{ name: "Remoção", color: "#dc2626" }]);
});
