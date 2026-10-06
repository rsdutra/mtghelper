# F-019 â€” PreÃ§o estimado na lista do deck

## Objetivo

Mostrar na view Texto do deck um valor estimado em reais para cada linha, calculado a partir do preÃ§o em dÃ³lar da Scryfall, e deixar tags e preÃ§o como itens opcionais do menu â€œExibirâ€.

## Escopo

- PreÃ§o estimado em R$ na linha da view Texto, opcional no menu â€œExibirâ€ â€” US-019-01.
- Tags da linha passam a ser opcionais no menu â€œExibirâ€; a coluna das tags fica mais estreita â€” US-019-02.
- O menu â€œExibirâ€ passa a existir tambÃ©m na visualizaÃ§Ã£o (`/decks/[id]`) â€” US-019-03.

## Fora de escopo

- CotaÃ§Ã£o do dÃ³lar real (API de cÃ¢mbio). Nesta versÃ£o a taxa Ã© fixa: US$ 1 = R$ 5.
- Atualizar o preÃ§o da Scryfall periodicamente. Vale o `usd` gravado no catÃ¡logo quando a carta foi baixada.
- PreÃ§o nas views Grid visual e Grid visual agrupada, e no canvas.
- Total do deck.
- PreÃ§o manual da carta (F-004 / US-004-10): continua no modal de detalhes, sem relaÃ§Ã£o com o estimado.

## User stories

### US-019-01 â€” PreÃ§o estimado na linha

**Como** jogador **quero** ver quanto custa cada linha do deck **para** ter uma ideia do valor sem sair da lista.

CritÃ©rios de aceite:

- [x] O menu â€œExibirâ€ tem a opÃ§Ã£o â€œPreÃ§o estimadoâ€, desligada por padrÃ£o.
- [x] Ligada, cada linha da view Texto mostra, numa coluna Ã  direita, `quantidade Ã— US$ Ã— 5` no formato `R$ 0,00`.
- [x] Passar o mouse sobre o valor mostra a dica â€œValor estimadoâ€.
- [x] Sem preÃ§o em dÃ³lar para a carta, a linha mostra â€œâ€”â€, com a mesma dica.

### US-019-02 â€” Tags opcionais e coluna menor

**Como** jogador **quero** ligar ou desligar as bolinhas de tag **para** abrir espaÃ§o na linha para o preÃ§o.

CritÃ©rios de aceite:

- [x] O menu â€œExibirâ€ tem a opÃ§Ã£o â€œTagsâ€, desligada por padrÃ£o.
- [x] Ligada, as bolinhas aparecem Ã  esquerda da quantidade, como hoje; desligada, a coluna some.
- [x] A coluna das tags fica mais estreita que antes.

### US-019-03 â€” Exibir na visualizaÃ§Ã£o

**Como** jogador **quero** as mesmas opÃ§Ãµes na visualizaÃ§Ã£o **para** ler o deck com preÃ§o sem entrar na ediÃ§Ã£o.

CritÃ©rios de aceite:

- [x] A visualizaÃ§Ã£o (`/decks/[id]`) tem o menu â€œExibirâ€ ao lado de â€œVisualizaÃ§Ã£oâ€, com Custo de mana, Tags e PreÃ§o estimado.
- [x] A escolha Ã© a mesma nas duas rotas (salva no navegador).

## DecisÃµes (confirmadas com o usuÃ¡rio)

1. Feature nova F-019.
2. Taxa fixa: US$ 1 = R$ 5, atÃ© existir uma soluÃ§Ã£o melhor.
3. SÃ³ na view Texto, nas duas rotas (ediÃ§Ã£o e visualizaÃ§Ã£o). O â€œExibirâ€ passa a existir na visualizaÃ§Ã£o.
4. Custo de mana, Tags e PreÃ§o estimado comeÃ§am desligados.
5. O valor da linha Ã© o total: quantidade Ã— preÃ§o de uma cÃ³pia.
6. ImpressÃ£o sem `usd` (comum em impressÃµes em portuguÃªs): usa o `usd` da impressÃ£o mais recente da mesma carta (`oracle_id`) que jÃ¡ estÃ¡ no catÃ¡logo. Sem nenhuma, mostra â€œâ€”â€.

## Regras

- O preÃ§o vem de `catalog_cards.filters->>'usd'` (Scryfall `prices.usd`, nÃ£o foil).
- O cÃ¡lculo Ã© feito em centavos: `round(usd Ã— 5 Ã— 100) Ã— quantidade`.
- Nenhuma opÃ§Ã£o do â€œExibirâ€ grava no deck; sÃ³ muda o que a linha desenha.

## SuperfÃ­cie

- API: `GET /api/decks/[id]` devolve `usd` por carta (com o fallback da decisÃ£o 6).
- UI: `TextListOptions` (novas opÃ§Ãµes), `DeckCardView` (colunas da linha), `deck-detail.tsx` (Exibir nas duas rotas).
- LÃ³gica: `src/lib/estimated-price.ts`.
- Dados: preferÃªncia em `localStorage` (`mtghelper.deck.textOptions`), sem migration.
- Teste: `tests/f019-preco-estimado.spec.ts`.

## RelaÃ§Ã£o com outras features

- F-006: catÃ¡logo local, de onde vem o `usd`.
- F-011: a visualizaÃ§Ã£o ganha o â€œExibirâ€.
- F-013: bolinhas de tag.
- F-017: menu â€œExibirâ€ e colunas da linha; as tags deixam de ser fixas.
