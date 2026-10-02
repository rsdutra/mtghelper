# F-015 — Ferramentas de construção de deck

## Objetivo

Reunir ferramentas que ajudam o jogador a montar um deck melhor, adaptadas do Moxfield (referência). A primeira é a análise de cores de mana: quanto o deck pede de cada cor e quanto os terrenos geram de cada cor.

## Escopo

- Seção “Ferramentas de construção” na tela do deck, que vai receber as próximas ferramentas como novas user stories desta feature.
- Gráfico de pizza com os símbolos de mana por cor exigidos pelas cartas do deck — US-015-01.
- Gráfico de pizza com a produção de mana por cor dos terrenos do deck — US-015-02.
- Metadado `produced_mana` da Scryfall (já gravado em `catalog_cards.filters`) entregue pela API do deck.

## Fora de escopo

- Sugestão automática de quantos terrenos de cada cor usar (pode virar outra user story).
- Contar fontes de mana que não são terrenos (artefatos, criaturas, feitiços de ramp).
- Probabilidade de comprar a cor (hipergeométrica).
- Mudanças no banco.

## User stories

### US-015-01 — Símbolos de mana por cor

**Como** jogador **quero** ver, num gráfico de pizza, quantos símbolos de mana de cada cor as cartas do deck pedem **para** saber quais cores o deck mais precisa.

Critérios de aceite:

- [x] Cada símbolo colorido no custo conta 1 para a sua cor, multiplicado pela quantidade da carta. Ex.: `{1}{B}{B}` conta 2 pretas; 4 cópias contam 8.
- [x] Mana genérica (`{1}`, `{2}`…) e `{X}`/`{Y}`/`{Z}` não contam.
- [x] Terrenos não entram nesta contagem.
- [x] A pizza mostra uma fatia por cor, com a cor do símbolo de mana.
- [x] A legenda mostra, para cada cor, o total de símbolos e a porcentagem.
- [x] A legenda fica em ordem decrescente de contagem.
- [x] O total de símbolos do deck aparece junto do gráfico.
- [x] Deck sem símbolos de cor mostra um aviso no lugar da pizza.

### US-015-02 — Produção de mana dos terrenos

**Como** jogador **quero** ver, num gráfico de pizza, quantos terrenos geram cada cor **para** conferir se a base de mana acompanha o que o deck pede.

Critérios de aceite:

- [x] Só terrenos (type line com “Land”) entram nesta contagem.
- [x] Um terreno conta 1 para cada cor que ele gera, multiplicado pela quantidade. Ex.: um terreno que gera vermelho e preto conta 1 vermelha e 1 preta.
- [x] As cores vêm do campo `produced_mana` da Scryfall.
- [x] A pizza mostra uma fatia por cor; a legenda mostra o total de terrenos daquela cor e a porcentagem.
- [x] A legenda fica em ordem decrescente de contagem.
- [x] O total de terrenos do deck aparece junto do gráfico.
- [x] Terrenos sem produção direta aparecem na linha “N terrenos sem produção direta”.
- [x] Deck sem terrenos que gerem mana mostra um aviso no lugar da pizza.

## Regras

- Cores: Branco (W), Azul (U), Preto (B), Vermelho (R), Verde (G), Incolor (C).
- Legenda e fatias em ordem decrescente de contagem; empate segue a ordem W, U, B, R, G, C.
- A porcentagem de cada fatia é a contagem da cor dividida pela soma das contagens de todas as cores do gráfico, arredondada para inteiro.
- Entram as cartas de “No deck” e do Sideboard; “Fora do deck” não entra. O filtro por tag (F-013) não muda os gráficos.
- Símbolos: `{W}` conta 1 para W; híbrido `{W/U}` conta 1 para W e 1 para U; phyrexiano `{B/P}` e `{2/W}` contam 1 para a cor; `{C}` conta 1 para Incolor.
- Terreno é a carta com “Land” em alguma face do type line. Carta cuja face da frente não é terreno (MDFC como “Sorcery // Land”) conta seus símbolos na US-015-01 **e** a produção na US-015-02.
- Carta dupla-face sem custo no topo (transformação) usa o custo da face da frente.
- Terreno com `produced_mana` vazio (fetch, ex.: Evolving Wilds) fica fora da pizza e soma na linha “N terrenos sem produção direta”.
- Carta antiga do catálogo sem `filters`: a API busca os metadados na Scryfall uma vez e grava, como a coleção já faz (F-005). Se a Scryfall falhar, as cores do terreno saem dos tipos básicos no type line (Plains, Island, Swamp, Mountain, Forest).
- O cálculo fica numa função pura (`src/lib/mana-colors.ts`), sem acesso ao banco nem à tela.

## Decisões (confirmadas com o usuário)

1. Novo botão de ícone “Ferramentas de construção” na coluna de botões à direita, abaixo de “Tags”, abrindo um painel lateral. Vale na edição e na visualização.
2. Entram “No deck” + Sideboard, como os gráficos de tipo e curva (US-004-09).
3. Híbrido conta 1 para cada cor; phyrexiano e `{2/W}` contam 1 para a cor.
4. Incolor (`{C}` no custo; terreno que gera C) é uma fatia própria nos dois gráficos.
5. Terreno sem produção direta fica fora da pizza, com a linha “N terrenos sem produção direta”.

## Testes

- `tests/f015-mana-colors.spec.ts`:
  - Cálculo puro: símbolos simples, híbridos, phyrexianos, `{2/W}`, `{C}`, `{X}`; quantidade; terrenos fora da US-015-01; MDFC e dupla-face; terreno de duas cores; fetch sem produção; artefato que gera mana fora da US-015-02; catálogo sem metadado; porcentagens.
  - Tela: botão abaixo de “Tags”, totais e legendas com cartas reais (deck + sideboard contam, “Fora do deck” não), atualização ao adicionar um terreno, fechar o painel, visualização com os mesmos números e deck vazio com avisos.

## Superfície

- Lib: `src/lib/mana-colors.ts` (cálculo), `src/lib/cards.ts` (`hydrateMissingFilters`, compartilhado com a coleção)
- UI: `src/components/deck-build-tools/deck-build-tools.tsx`, pizza genérica `src/components/pie-chart.tsx` (também usada na distribuição por tipo, US-004-09), botão e painel em `src/components/deck-detail/deck-detail.tsx`
- API: `GET /api/decks/[id]` devolve `produced_mana` e `front_mana_cost` de cada carta e completa `filters` faltantes na Scryfall
- Dados: `catalog_cards.filters->'produced_mana'` e `filters->>'mana_cost'` (sem migration)

## Relação com outras features

- F-004 / US-004-09: gráficos de tipo e curva de mana já existentes.
- F-006: catálogo local com os metadados Scryfall.
- F-011: telas de visualização e edição do deck.
