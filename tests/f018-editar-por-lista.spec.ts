import { expect, test, type Page } from "@playwright/test";
import { matchDeckCard, type DeckListExistingCard } from "../src/lib/deck-list-edit";

/**
 * F-018 / US-018-01 — botão “Editar por lista” com Deck, Sideboard e Maybeboard em texto.
 * F-018 / US-018-02 — salvar deixa o deck igual às listas (inglês ou português).
 * F-018 / US-018-03 — “Fora do deck” virou Maybeboard.
 */
const stamp = Date.now();

type ApiCard = {
  id: string;
  name_en: string;
  place: "main" | "side" | "out";
  quantity: number;
  price_cents: number | null;
  tags: { name: string; color: string }[];
};

function existing(
  catalogCardId: string,
  name_en: string,
  name_pt: string | null,
  quantities: Partial<DeckListExistingCard["quantities"]> = {},
): DeckListExistingCard {
  return { catalogCardId, name_en, name_pt, quantities: { main: 0, side: 0, out: 0, ...quantities } };
}

test("casa o nome com as cartas do deck", () => {
  const cards = [
    existing("bolt", "Lightning Bolt", "Raio", { main: 4 }),
    existing("delver", "Delver of Secrets // Insectile Aberration", null, { main: 1 }),
    existing("island-a", "Island", "Ilha", { main: 10 }),
    existing("island-b", "Island", "Ilha", { out: 2 }),
  ];
  expect(matchDeckCard(cards, "lightning bolt", "main")?.catalogCardId).toBe("bolt");
  expect(matchDeckCard(cards, "Raio", "side")?.catalogCardId).toBe("bolt");
  expect(matchDeckCard(cards, "Delver of Secrets", "main")?.catalogCardId).toBe("delver");
  expect(matchDeckCard(cards, "Island", "main")?.catalogCardId).toBe("island-a");
  expect(matchDeckCard(cards, "Ilha", "out")?.catalogCardId).toBe("island-b");
  expect(matchDeckCard(cards, "Counterspell", "main")).toBeNull();
});

async function register(page: Page, login: string) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);
}

async function createDeck(page: Page, name: string, format: string, lists: Partial<Record<"main" | "side" | "out", string>>) {
  const created = await page.request.post("/api/decks", { data: { name, format } });
  const { deck } = (await created.json()) as { deck: { id: string } };
  for (const [place, text] of Object.entries(lists)) {
    const added = await page.request.post(`/api/decks/${deck.id}/cards`, { data: { text, place } });
    expect(added.ok()).toBeTruthy();
  }
  return deck.id;
}

async function deckCards(page: Page, deckId: string) {
  const data = (await (await page.request.get(`/api/decks/${deckId}`)).json()) as { cards: ApiCard[] };
  return data.cards;
}

function summary(cards: ApiCard[]) {
  return cards.map((card) => `${card.place} ${card.quantity} ${card.name_en}`).sort();
}

test("edita deck, sideboard e maybeboard por lista", async ({ page }) => {
  await register(page, `bylist${stamp}`);
  const deckId = await createDeck(page, "Editar por lista", "modern", {
    main: "4 Lightning Bolt\n2 Mountain",
    side: "3 Pyroblast",
    out: "1 Shock",
  });
  const bolt = (await deckCards(page, deckId)).find((card) => card.name_en === "Lightning Bolt");
  expect(bolt).toBeTruthy();
  const tag = { name: "Remoção", color: "#d03030" };
  const patched = await page.request.patch(`/api/decks/${deckId}/cards`, {
    data: { catalogCardId: bolt!.id, priceCents: 250, tags: [tag] },
  });
  expect(patched.ok()).toBeTruthy();

  // Visualização não tem o botão.
  await page.goto(`/decks/${deckId}`);
  await expect(page.getByTestId("deck-card-text").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Editar por lista" })).toHaveCount(0);

  await page.goto(`/decks/${deckId}/edit`);
  await expect(page.getByRole("heading", { level: 2, name: "Maybeboard", exact: true })).toBeVisible();
  const button = page.getByRole("button", { name: "Editar por lista" });
  await expect(button).toBeEnabled();
  const viewSelect = page.getByLabel("Visualização");
  const buttonBox = await button.boundingBox();
  const selectBox = await viewSelect.boundingBox();
  expect(buttonBox && selectBox).toBeTruthy();
  if (buttonBox && selectBox) {
    expect(Math.abs(buttonBox.y + buttonBox.height / 2 - (selectBox.y + selectBox.height / 2))).toBeLessThanOrEqual(4);
    expect(buttonBox.x).toBeLessThan(selectBox.x);
  }

  // US-018-01: listas carregadas em inglês, uma aba por lugar.
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Editar por lista" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("tab")).toHaveText(["Deck", "Sideboard", "Maybeboard"]);
  const deckList = dialog.getByLabel("Lista do Deck");
  const sideList = dialog.getByLabel("Lista do Sideboard");
  const maybeList = dialog.getByLabel("Lista do Maybeboard");
  await expect(deckList).toHaveValue("4 Lightning Bolt\n2 Mountain");
  await dialog.getByRole("tab", { name: "Sideboard" }).click();
  await expect(sideList).toBeVisible();
  await expect(sideList).toHaveValue("3 Pyroblast");
  await dialog.getByRole("tab", { name: "Maybeboard" }).click();
  await expect(maybeList).toHaveValue("1 Shock");

  // Cancelar não grava.
  await maybeList.fill("4 Shock");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  expect(summary(await deckCards(page, deckId))).toEqual([
    "main 2 Mountain",
    "main 4 Lightning Bolt",
    "out 1 Shock",
    "side 3 Pyroblast",
  ]);

  // Nome não reconhecido: nada é gravado e a linha é apontada.
  await button.click();
  await expect(dialog).toBeVisible();
  await deckList.fill("4 Lightning Bolt\n1 Carta Inexistente Zzqx");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Deck, linha 2: Carta Inexistente Zzqx");
  await expect(dialog).toBeVisible();
  expect(summary(await deckCards(page, deckId))).toHaveLength(4);

  // US-018-02: nome em português, quantidade alterada, carta movida, linhas repetidas e sideboard vazio.
  await deckList.fill("3 Lightning Bolt\n2 Contramágica");
  await dialog.getByRole("tab", { name: "Sideboard" }).click();
  await sideList.fill("");
  await dialog.getByRole("tab", { name: "Maybeboard" }).click();
  await maybeList.fill("1 Shock\n1 Shock\n2 Mountain");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toHaveCount(0);

  const saved = await deckCards(page, deckId);
  expect(summary(saved)).toEqual([
    "main 2 Counterspell",
    "main 3 Lightning Bolt",
    "out 2 Mountain",
    "out 2 Shock",
  ]);
  const savedBolt = saved.find((card) => card.name_en === "Lightning Bolt");
  expect(savedBolt?.id).toBe(bolt!.id);
  expect(savedBolt?.price_cents).toBe(250);
  expect(savedBolt?.tags).toEqual([tag]);

  // A tela recarrega com o resultado.
  await expect(page.getByRole("heading", { level: 2, name: "Sideboard", exact: true })).toBeVisible();
  const sidePanel = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { level: 2, name: "Sideboard", exact: true }) });
  await expect(sidePanel.getByText("Nenhuma carta no sideboard.")).toBeVisible();

  await button.click();
  await expect(deckList).toHaveValue("2 Counterspell\n3 Lightning Bolt");
});

test("formato sem sideboard mostra só Deck e Maybeboard", async ({ page }) => {
  await register(page, `bylistcmd${stamp}`);
  const deckId = await createDeck(page, "Editar por lista Commander", "commander", { main: "1 Sol Ring" });
  await page.goto(`/decks/${deckId}/edit`);
  await expect(page.getByRole("button", { name: "Editar por lista" })).toBeEnabled();
  await page.getByRole("button", { name: "Editar por lista" }).click();
  const dialog = page.getByRole("dialog", { name: "Editar por lista" });
  await expect(dialog.getByRole("tab")).toHaveText(["Deck", "Maybeboard"]);
  await expect(dialog.getByLabel("Lista do Deck")).toHaveValue("1 Sol Ring");

  await dialog.getByLabel("Lista do Deck").fill("1 Sol Ring\n1 Arcane Signet");
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toHaveCount(0);
  expect(summary(await deckCards(page, deckId))).toEqual(["main 1 Arcane Signet", "main 1 Sol Ring"]);
});
