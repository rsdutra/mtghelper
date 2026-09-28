import { expect, test, type Page } from "@playwright/test";

/** F-008 / US-008-08 — Canvas de deck (Konva). */
const stamp = Date.now();
const login = `konva${stamp}`;
const password = "senha123";

type DeckCard = { id: string; name_en: string; quantity: number };
type DeckData = { cards: DeckCard[] };
type Snapshot = {
  camera: { x: number; y: number; scale: number };
  cards: Record<string, { parent: string | null; x: number; y: number }>;
  frames: Record<string, { x: number; y: number; w: number; h: number }>;
};

const CARD_W = 146;
const CARD_H = 204;

async function deckData(page: Page, deckId: string): Promise<DeckData> {
  const response = await page.request.get(`/api/decks/${deckId}`);
  return (await response.json()) as DeckData;
}

async function snapshot(page: Page, deckId: string): Promise<Snapshot> {
  const response = await page.request.get(`/api/decks/${deckId}/canvas`);
  return ((await response.json()) as { snapshot: Snapshot }).snapshot;
}

async function saveCanvas(page: Page, deckId: string) {
  const saved = page.waitForResponse(
    (response) => response.url().endsWith(`/api/decks/${deckId}/canvas`) && response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  expect((await saved).ok()).toBe(true);
}

async function cardCenterOnScreen(page: Page, snap: Snapshot, key: string) {
  const box = await page.getByTestId("konva-canvas").boundingBox();
  if (!box) throw new Error("canvas sem bounding box");
  const pos = snap.cards[key];
  const frame = pos.parent ? snap.frames[pos.parent] : null;
  const x = (frame?.x ?? 0) + pos.x + CARD_W / 2;
  const y = (frame?.y ?? 0) + pos.y + CARD_H / 2;
  return {
    x: box.x + snap.camera.x + x * snap.camera.scale,
    y: box.y + snap.camera.y + y * snap.camera.scale,
  };
}

test("canvas: snapshot, mover carta, deletar e menu", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  await page.getByLabel("Nome do deck").fill("Konva Test");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/decks\/[^/]+\/edit$/);
  const deckId = page.url().split("/decks/")[1].split("/")[0];

  await page.getByPlaceholder("1 Sol Ring").fill("1 Sol Ring");
  await page.getByRole("button", { name: "Adicionar ao deck" }).click();
  await expect(page.getByText("Sol Ring").first()).toBeVisible();
  await page.getByPlaceholder("1 Sol Ring").fill("3 Lightning Bolt");
  await page.getByRole("button", { name: "Adicionar ao deck" }).click();
  await expect(page.getByText("Lightning Bolt").first()).toBeVisible();

  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(page.getByTestId("konva-canvas").locator("canvas").first()).toBeVisible();
  await saveCanvas(page, deckId);

  const data = await deckData(page, deckId);
  const solRing = data.cards.find((card) => card.name_en === "Sol Ring")!;
  const bolt = data.cards.find((card) => card.name_en === "Lightning Bolt")!;

  let snap = await snapshot(page, deckId);
  expect(Object.keys(snap.cards)).toHaveLength(4);
  expect(Object.keys(snap.frames)).toHaveLength(0);

  const from = await cardCenterOnScreen(page, snap, `card:${solRing.id}:0`);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 80, from.y + 40, { steps: 12 });
  await page.mouse.up();

  // Delete remove 1 cópia da carta selecionada.
  const boltCenter = await cardCenterOnScreen(page, snap, `card:${bolt.id}:0`);
  await page.mouse.click(boltCenter.x, boltCenter.y);
  await page.keyboard.press("Delete");
  await expect
    .poll(async () => (await deckData(page, deckId)).cards.find((card) => card.id === bolt.id)?.quantity)
    .toBe(2);

  // Menu do botão direito.
  const menuTarget = await cardCenterOnScreen(page, snap, `card:${bolt.id}:1`);
  await page.mouse.click(menuTarget.x, menuTarget.y, { button: "right" });
  await expect(page.getByRole("menuitem", { name: "Copiar nome", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  // Preview ampliado após ~1,5 s parado sobre a carta.
  await page.mouse.move(menuTarget.x + 2, menuTarget.y + 2);
  await page.mouse.move(menuTarget.x + 4, menuTarget.y + 4);
  await expect(page.locator("div.pointer-events-none.fixed img")).toBeVisible({ timeout: 5_000 });
  await page.mouse.move(5, 5);

  // Layout persiste após salvar e recarregar.
  await saveCanvas(page, deckId);
  snap = await snapshot(page, deckId);
  expect(snap.cards[`card:${solRing.id}:0`].parent).toBeNull();
  expect(Object.keys(snap.cards)).toHaveLength(3);

  await page.reload();
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(page.getByTestId("konva-canvas").locator("canvas").first()).toBeVisible();
  await expect(page.getByText(/^Salvo /)).toBeVisible();

  // Shift+arrastar seleciona as cópias restantes; Delete remove as duas.
  const boltKeys = [`card:${bolt.id}:0`, `card:${bolt.id}:1`];
  const corners = await Promise.all(boltKeys.map((key) => cardCenterOnScreen(page, snap, key)));
  const half = { w: (CARD_W / 2) * snap.camera.scale, h: (CARD_H / 2) * snap.camera.scale };
  const minX = Math.min(...corners.map((point) => point.x)) - half.w - 6;
  const minY = Math.min(...corners.map((point) => point.y)) - half.h - 6;
  const maxX = Math.max(...corners.map((point) => point.x)) + half.w - 10;
  const maxY = Math.max(...corners.map((point) => point.y)) + half.h - 10;
  await page.keyboard.down("Shift");
  await page.mouse.move(minX, minY);
  await page.mouse.down();
  await page.mouse.move(maxX, maxY, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await page.keyboard.press("Delete");
  await expect
    .poll(async () => (await deckData(page, deckId)).cards.some((card) => card.id === bolt.id))
    .toBe(false);
  expect((await deckData(page, deckId)).cards.some((card) => card.id === solRing.id)).toBe(true);

  // Voltar para a lista salva o canvas pendente.
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.getByPlaceholder("1 Sol Ring")).toBeVisible();
});
