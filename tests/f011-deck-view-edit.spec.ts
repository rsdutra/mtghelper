import { expect, test, type Page } from "@playwright/test";

/** F-011 — Deck: modo visualização (`/decks/[id]`) e modo edição (`/decks/[id]/edit`). */
const stamp = Date.now();
const login = `viewedit${stamp}`;
const password = "senha123";

type DeckCard = { name_en: string; name_pt: string | null };

async function cardLabel(page: Page, deckId: string, nameEn: string) {
  const response = await page.request.get(`/api/decks/${deckId}`);
  const data = (await response.json()) as { cards: DeckCard[] };
  const card = data.cards.find((item) => item.name_en === nameEn);
  if (!card) throw new Error(`carta ${nameEn} não está no deck`);
  return card.name_pt ?? card.name_en;
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

test("visualização somente leitura, colunas condensadas e ida/volta da edição", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(login);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  // US-011-04: criar o deck abre direto a edição.
  await page.getByLabel("Nome do deck").fill("F011 Deck");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page).toHaveURL(/\/decks\/[^/]+\/edit$/);
  const deckId = page.url().split("/decks/")[1].split("/")[0];

  await expect(page.getByLabel("Nome do deck")).toHaveValue("F011 Deck");
  await addToDeck(page, "1 Sol Ring", "Sol Ring");
  await addToDeck(page, "3 Lightning Bolt", "Lightning Bolt");
  await addToDeck(page, "1 Island", "Island");
  const bolt = await cardLabel(page, deckId, "Lightning Bolt");
  await expect(page.getByRole("button", { name: `Aumentar ${bolt}` })).toBeVisible();

  // US-011-04: voltar para a visualização.
  await page.getByRole("link", { name: "Concluir edição" }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deckId}$`));

  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes(`/api/decks/${deckId}`)) writes.push(request.url());
  });

  // US-011-02: nome e formato como texto; sem ações e sem ferramentas.
  await expect(page.getByRole("heading", { level: 1, name: "F011 Deck" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Nome do deck" })).toHaveCount(0);
  await expect(page.getByLabel("Formato")).toHaveCount(0);
  await expect(page.getByPlaceholder("1 Sol Ring")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Escanear carta" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `Aumentar ${bolt}` })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "No deck", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exportar", exact: true })).toBeVisible();

  // US-011-03: linhas compactas “qtd nome”.
  const textView = page.getByTestId("deck-view-texto").first();
  const boltRow = textView.getByTestId("deck-card-text").filter({ hasText: bolt });
  await expect(boltRow).toHaveText(new RegExp(`^3\\s*${bolt}$`));

  // US-011-03: grupos lado a lado em colunas, recolhíveis, sem gravar nada na visualização.
  await page.getByRole("checkbox", { name: /Agrupar por tipo/ }).check();
  const artifacts = page.getByRole("button", { name: /Artefatos/ });
  const instants = page.getByRole("button", { name: /Instantâneos/ });
  await expect(artifacts).toBeVisible();
  await expect(instants).toBeVisible();
  const artifactsBox = (await artifacts.boundingBox())!;
  const instantsBox = (await instants.boundingBox())!;
  expect(Math.abs(artifactsBox.y - instantsBox.y)).toBeLessThanOrEqual(2);
  expect(artifactsBox.x).not.toBe(instantsBox.x);
  await instants.click();
  await expect(boltRow).toHaveCount(0);
  await instants.click();
  await expect(boltRow).toBeVisible();

  // Preview ao pairar no nome (F-010 / US-010-05).
  await boltRow.hover();
  await expect(page.getByTestId("card-hover-preview")).toBeVisible();
  await page.mouse.move(5, 5);

  // US-011-01: sem overflow horizontal no mobile.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
  await page.setViewportSize({ width: 1600, height: 900 });

  // US-011-04: canvas somente leitura na visualização.
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deckId}\\?view=canvas$`));
  await expect(page.getByTestId("konva-canvas").locator("canvas").first()).toBeVisible();
  await expect(page.getByText(/Somente leitura/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir painel de busca" })).toHaveCount(0);
  const box = (await page.getByTestId("konva-canvas").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press("Delete");
  expect(writes).toEqual([]);

  // Editar a partir do canvas mantém o canvas, agora editável.
  await page.getByRole("link", { name: "Editar" }).click();
  await expect(page).toHaveURL(new RegExp(`/decks/${deckId}/edit\\?view=canvas$`));
  await expect(page.getByRole("button", { name: "Salvar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir painel de busca" })).toBeVisible();
});
