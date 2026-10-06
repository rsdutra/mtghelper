import { expect, test } from "@playwright/test";

/** F-004 — a mesma carta pode ter quantidade no deck, no sideboard e fora. */
const stamp = Date.now();
const login = `places${stamp}`;
const password = "senha123";

type DeckCard = { name_en: string; quantity: number; place: string };

test("lista do maybeboard não move as cartas que já estão no deck", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  const created = await page.request.post("/api/decks", {
    data: { name: "Places", format: "modern" },
  });
  expect(created.ok()).toBeTruthy();
  const { deck } = (await created.json()) as { deck: { id: string } };

  const list = "2 Sol Ring\n1 Command Tower";
  const main = await page.request.post(`/api/decks/${deck.id}/cards`, {
    data: { text: list, place: "main" },
  });
  expect(main.ok()).toBeTruthy();

  const side = await page.request.post(`/api/decks/${deck.id}/cards`, {
    data: { text: "1 Sol Ring", place: "side" },
  });
  expect(side.ok()).toBeTruthy();

  const out = await page.request.post(`/api/decks/${deck.id}/cards`, {
    data: { text: list, place: "out" },
  });
  expect(out.ok()).toBeTruthy();

  const loaded = await page.request.get(`/api/decks/${deck.id}`);
  expect(loaded.ok()).toBeTruthy();
  const cards = ((await loaded.json()) as { cards: DeckCard[] }).cards;
  const of = (name: string) =>
    cards
      .filter((card) => card.name_en === name)
      .map((card) => `${card.place}:${card.quantity}`)
      .sort();

  expect(of("Sol Ring")).toEqual(["main:2", "out:2", "side:1"]);
  expect(of("Command Tower")).toEqual(["main:1", "out:1"]);
});
