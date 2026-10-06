import { expect, test, type Page } from "@playwright/test";
import {
  colorPips,
  landProductionDistribution,
  manaSymbolDistribution,
} from "../src/lib/mana-colors";

/** F-015 / US-015-01, US-015-02 — símbolos de mana por cor e produção de mana dos terrenos. */
const stamp = Date.now();

function pips(partial: Partial<Record<"W" | "U" | "B" | "R" | "G" | "C", number>>) {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...partial };
}

test.describe("cálculo das cores de mana", () => {
  test("conta os símbolos de cor de uma cópia", () => {
    expect(colorPips("{1}{B}{B}")).toEqual(pips({ B: 2 }));
    expect(colorPips("{X}{R}{R}")).toEqual(pips({ R: 2 }));
    expect(colorPips("{W/U}{W/U}")).toEqual(pips({ W: 2, U: 2 }));
    expect(colorPips("{B/P}")).toEqual(pips({ B: 1 }));
    expect(colorPips("{2/W}")).toEqual(pips({ W: 1 }));
    expect(colorPips("{G/U/P}")).toEqual(pips({ G: 1, U: 1 }));
    expect(colorPips("{C}{C}{3}")).toEqual(pips({ C: 2 }));
    expect(colorPips(null)).toEqual(pips({}));
  });

  test("US-015-01: soma os símbolos × quantidade, sem terrenos", () => {
    const stats = manaSymbolDistribution([
      { quantity: 4, type_line: "Instant", mana_cost: "{R}" },
      { quantity: 2, type_line: "Instant", mana_cost: "{1}{B}" },
      { quantity: 1, type_line: "Creature — Giant Warrior", mana_cost: "{1}{G/W}{G/W}" },
      { quantity: 3, type_line: "Basic Land — Swamp", mana_cost: null, produced_mana: ["B"] },
      // MDFC com feitiço na frente: conta o custo da frente.
      { quantity: 1, type_line: "Sorcery // Land", mana_cost: null, front_mana_cost: "{3}{W}{W}" },
      // Dupla-face de transformação sem custo no topo.
      { quantity: 1, type_line: "Creature — Human // Creature — Faerie", mana_cost: null, front_mana_cost: "{U}" },
    ]);
    expect(stats.total).toBe(13);
    // Decrescente; empate segue W, U, B, R, G, C.
    expect(stats.slices.map(({ color, count, percent }) => ({ color, count, percent }))).toEqual([
      { color: "W", count: 4, percent: 31 },
      { color: "R", count: 4, percent: 31 },
      { color: "B", count: 2, percent: 15 },
      { color: "G", count: 2, percent: 15 },
      { color: "U", count: 1, percent: 8 },
    ]);
  });

  test("US-015-02: terreno de duas cores conta para as duas", () => {
    const stats = landProductionDistribution([
      { quantity: 1, type_line: "Land — Swamp Mountain", produced_mana: ["B", "R"] },
      { quantity: 3, type_line: "Basic Land — Swamp", produced_mana: ["B"] },
      { quantity: 1, type_line: "Land", produced_mana: [] },
      { quantity: 1, type_line: "Artifact", produced_mana: ["C"] },
      { quantity: 1, type_line: "Basic Land", produced_mana: ["C"] },
      // Catálogo sem metadado: cores pelos tipos básicos.
      { quantity: 2, type_line: "Land — Island Swamp", produced_mana: null },
      { quantity: 1, type_line: "Sorcery // Land", produced_mana: ["W"] },
    ]);
    expect(stats.lands).toBe(9);
    expect(stats.withoutProduction).toBe(1);
    expect(stats.slices.map(({ color, count, percent }) => ({ color, count, percent }))).toEqual([
      { color: "B", count: 6, percent: 55 },
      { color: "U", count: 2, percent: 18 },
      { color: "W", count: 1, percent: 9 },
      { color: "R", count: 1, percent: 9 },
      { color: "C", count: 1, percent: 9 },
    ]);
  });

  test("deck sem cartas não gera fatias", () => {
    expect(manaSymbolDistribution([])).toEqual({ slices: [], total: 0 });
    expect(landProductionDistribution([])).toEqual({ slices: [], lands: 0, withoutProduction: 0 });
  });
});

async function legend(page: Page, chart: string) {
  return page.getByRole("list", { name: `Legenda: ${chart}` }).getByRole("listitem").allTextContents();
}

test("painel Ferramentas de construção na edição e na visualização", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(`manacolors${stamp}`);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  const created = await page.request.post("/api/decks", { data: { name: "Cores de mana", format: "modern" } });
  expect(created.ok()).toBeTruthy();
  const { deck } = (await created.json()) as { deck: { id: string } };
  const lists = [
    {
      place: "main",
      text: "4 Lightning Bolt\n2 Doom Blade\n1 Kitchen Finks\n1 Sol Ring\n1 Blood Crypt\n3 Swamp\n1 Evolving Wilds",
    },
    { place: "side", text: "2 Duress" },
    { place: "out", text: "4 Counterspell\n1 Island" },
  ];
  for (const { place, text } of lists) {
    const added = await page.request.post(`/api/decks/${deck.id}/cards`, { data: { text, place } });
    expect(added.ok()).toBeTruthy();
  }

  await page.goto(`/decks/${deck.id}/edit`);
  const tagsButton = page.getByRole("button", { name: "Tags", exact: true });
  const toolsButton = page.getByRole("button", { name: "Ferramentas de construção", exact: true });

  // Botão logo abaixo de “Tags”.
  await expect(toolsButton).toBeVisible();
  const tagsBox = (await tagsButton.boundingBox())!;
  const toolsBox = (await toolsButton.boundingBox())!;
  expect(Math.abs(toolsBox.x - tagsBox.x)).toBeLessThanOrEqual(1);
  expect(toolsBox.y).toBeGreaterThan(tagsBox.y + tagsBox.height - 1);

  await toolsButton.click();
  await expect(toolsButton).toHaveAttribute("aria-pressed", "true");

  // US-015-01: Bolt 4 R; Doom Blade 2 B; Duress (sideboard) 2 B; Kitchen Finks {G/W}{G/W} = 2 G e 2 W.
  // Counterspell está no Maybeboard e não conta.
  const symbols = page.getByRole("region", { name: "Símbolos de mana por cor" });
  await expect(symbols.getByText("Total: 12 símbolos.")).toBeVisible();
  await expect(symbols.getByRole("img", { name: "Símbolos de mana por cor" })).toBeVisible();
  await expect
    .poll(() => legend(page, "Símbolos de mana por cor"))
    .toEqual(["Preto: 4 (33%)", "Vermelho: 4 (33%)", "Branco: 2 (17%)", "Verde: 2 (17%)"]);

  // US-015-02: Blood Crypt conta preto e vermelho; 3 Swamp; Evolving Wilds sem produção; Sol Ring não é terreno.
  const lands = page.getByRole("region", { name: "Produção de mana dos terrenos" });
  await expect(lands.getByText("Total: 5 terrenos")).toBeVisible();
  await expect(lands.getByText("1 terreno sem produção direta")).toBeVisible();
  await expect
    .poll(() => legend(page, "Produção de mana dos terrenos"))
    .toEqual(["Preto: 4 (80%)", "Vermelho: 1 (20%)"]);

  // Adicionar um terreno incolor atualiza o gráfico. Abrir a Busca fecha as Ferramentas (um painel por vez).
  await page.getByRole("button", { name: "Busca", exact: true }).click();
  await expect(toolsButton).toHaveAttribute("aria-pressed", "false");
  await expect(symbols).toHaveCount(0);
  await page.getByRole("button", { name: "Adicionar lista" }).click();
  await page.getByLabel("Lista no deck").fill("1 Wastes");
  await page.getByRole("dialog").getByRole("button", { name: "Salvar" }).click();
  await toolsButton.click();
  await expect(page.getByRole("button", { name: "Busca", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(lands.getByText("Total: 6 terrenos")).toBeVisible();
  await expect
    .poll(() => legend(page, "Produção de mana dos terrenos"))
    .toEqual(["Preto: 4 (67%)", "Vermelho: 1 (17%)", "Incolor: 1 (17%)"]);

  // Fechar o painel.
  await toolsButton.click();
  await expect(symbols).toHaveCount(0);

  // Visualização: mesmo botão e mesmos números.
  await page.goto(`/decks/${deck.id}`);
  await page.getByRole("button", { name: "Ferramentas de construção", exact: true }).click();
  await expect
    .poll(() => legend(page, "Símbolos de mana por cor"))
    .toEqual(["Preto: 4 (33%)", "Vermelho: 4 (33%)", "Branco: 2 (17%)", "Verde: 2 (17%)"]);
  await expect
    .poll(() => legend(page, "Produção de mana dos terrenos"))
    .toEqual(["Preto: 4 (67%)", "Vermelho: 1 (17%)", "Incolor: 1 (17%)"]);
});

test("deck sem cartas mostra avisos no lugar das pizzas", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Login").fill(`manacolorsvazio${stamp}`);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Cadastrar" }).click();
  await expect(page).toHaveURL(/\/decks/);

  const created = await page.request.post("/api/decks", { data: { name: "Vazio", format: "modern" } });
  const { deck } = (await created.json()) as { deck: { id: string } };
  await page.goto(`/decks/${deck.id}`);
  await page.getByRole("button", { name: "Ferramentas de construção", exact: true }).click();
  await expect(page.getByText("Nenhum símbolo de mana de cor no deck.")).toBeVisible();
  await expect(page.getByText("Nenhum terreno que gere mana no deck.")).toBeVisible();
  await expect(page.getByText("Total: 0 terrenos")).toBeVisible();
});
