import { expect, test, type Page } from "@playwright/test";
import { missingCardList } from "../src/lib/deck-coverage";

/** F-004 / US-004-19 — clicar no aviso de cópias faltando e adicionar as cartas marcadas à coleção. */
const stamp = Date.now();

test("monta a lista de faltantes", () => {
  const list = missingCardList([
    { id: "c1", oracle_id: "o-bolt", place: "main", name_en: "Lightning Bolt", name_pt: "Relâmpago", missing: 4 },
    { id: "c1", oracle_id: "o-bolt", place: "side", name_en: "Lightning Bolt", name_pt: "Relâmpago", missing: 4 },
    { id: "c2", oracle_id: "o-counter", place: "main", name_en: "Counterspell", name_pt: null, missing: 2 },
    { id: "c3", oracle_id: "o-shock", place: "out", name_en: "Shock", name_pt: null, missing: 3 },
    { id: "c4", oracle_id: "o-island", place: "main", name_en: "Island", name_pt: null, missing: 0 },
    { id: "c5", oracle_id: null, place: "main", name_en: "Token", name_pt: null, missing: 1 },
  ]);
  expect(list).toEqual([
    { key: "o-counter", name: "Counterspell", missing: 2 },
    { key: "o-bolt", name: "Relâmpago", missing: 4 },
    { key: "c5", name: "Token", missing: 1 },
  ]);
});

type DeckCard = { name_en: string; name_pt: string | null };
type CollectionItem = { name_en: string; quantity: number };

async function labels(page: Page, deckId: string) {
  const data = (await (await page.request.get(`/api/decks/${deckId}`)).json()) as { cards: DeckCard[] };
  const label = (nameEn: string) => {
    const card = data.cards.find((item) => item.name_en === nameEn);
    if (!card) throw new Error(`carta ${nameEn} não está no deck`);
    return card.name_pt ?? card.name_en;
  };
  return { bolt: label("Lightning Bolt"), counter: label("Counterspell") };
}

async function collectionItems(page: Page, collectionId: string) {
  const data = (await (await page.request.get(`/api/collections/${collectionId}`)).json()) as { items: CollectionItem[] };
  return data.items;
}

test("adiciona à coleção as cartas faltantes marcadas", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(`faltantes${stamp}`);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  const { collections } = (await (await page.request.get("/api/collections")).json()) as {
    collections: { id: string }[];
  };
  const collectionId = collections[0].id;
  const owned = await page.request.post(`/api/collections/${collectionId}/cards`, { data: { text: "1 Lightning Bolt" } });
  expect(owned.ok()).toBeTruthy();

  const created = await page.request.post("/api/decks", { data: { name: "Faltantes", format: "modern" } });
  const { deck } = (await created.json()) as { deck: { id: string } };
  for (const [place, text] of [
    ["main", "4 Lightning Bolt\n2 Counterspell"],
    ["side", "1 Lightning Bolt"],
    ["out", "3 Shock"],
  ]) {
    const added = await page.request.post(`/api/decks/${deck.id}/cards`, { data: { text, place } });
    expect(added.ok()).toBeTruthy();
  }
  const names = await labels(page, deck.id);

  // Edição: aviso clicável; deck + sideboard somam, o Maybeboard e o que já tem ficam de fora.
  await page.goto(`/decks/${deck.id}/edit`);
  const badge = page.getByRole("button", { name: "Faltam 6 cópias · 2 cartas" });
  await badge.click();
  const dialog = page.getByRole("dialog", { name: "Cartas faltando na coleção" });
  await expect(dialog).toBeVisible();
  const rows = dialog.getByRole("list", { name: "Cartas faltando" }).getByRole("checkbox");
  await expect(rows).toHaveCount(2);
  const boltBox = dialog.getByRole("checkbox", { name: `4 ${names.bolt}` });
  const counterBox = dialog.getByRole("checkbox", { name: `2 ${names.counter}` });
  await expect(boltBox).toBeChecked();
  await expect(counterBox).toBeChecked();
  await expect(dialog.getByText("Shock")).toHaveCount(0);

  // Marcar todas desmarca e remarca; sem nenhuma marcada o botão fica desabilitado.
  const all = dialog.getByRole("checkbox", { name: "Marcar todas" });
  const addButton = dialog.getByRole("button", { name: "Adicionar à coleção" });
  await all.uncheck();
  await expect(boltBox).not.toBeChecked();
  await expect(counterBox).not.toBeChecked();
  await expect(addButton).toBeDisabled();
  await all.check();
  await expect(boltBox).toBeChecked();

  // Só Counterspell.
  await boltBox.uncheck();
  await expect(all).not.toBeChecked();
  await expect(dialog.getByText("2 cópias")).toBeVisible();
  await addButton.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Faltam 4 cópias · 1 carta" })).toBeVisible();
  const afterFirst = await collectionItems(page, collectionId);
  expect(afterFirst.filter((item) => item.name_en === "Counterspell").reduce((t, i) => t + i.quantity, 0)).toBe(2);
  expect(afterFirst.filter((item) => item.name_en === "Lightning Bolt").reduce((t, i) => t + i.quantity, 0)).toBe(1);

  // Cancelar não grava nada.
  await page.getByRole("button", { name: "Faltam 4 cópias · 1 carta" }).click();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);

  // Visualização: o aviso também abre a lista e grava na coleção.
  await page.goto(`/decks/${deck.id}`);
  await page.getByRole("button", { name: "Faltam 4 cópias · 1 carta" }).click();
  await expect(dialog.getByRole("checkbox", { name: `4 ${names.bolt}` })).toBeChecked();
  await dialog.getByRole("button", { name: "Adicionar à coleção" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Coleção: completo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Coleção: completo" })).toHaveCount(0);
  const afterSecond = await collectionItems(page, collectionId);
  expect(afterSecond.filter((item) => item.name_en === "Lightning Bolt").reduce((t, i) => t + i.quantity, 0)).toBe(5);
  expect(afterSecond.filter((item) => item.name_en === "Shock")).toHaveLength(0);
});
