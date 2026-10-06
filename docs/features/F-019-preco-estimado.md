# F-019 — Preço estimado na lista do deck

## Objetivo

Mostrar na view Texto do deck um valor estimado em reais para cada linha, calculado a partir do preço em dólar da Scryfall, e deixar tags e preço como itens opcionais do menu “Exibir”.

## Escopo

- Preço estimado em R$ na linha da view Texto, opcional no menu “Exibir” — US-019-01.
- Tags da linha passam a ser opcionais no menu “Exibir”; a coluna das tags fica mais estreita — US-019-02.
- O menu “Exibir” passa a existir também na visualização (`/decks/[id]`) — US-019-03.

## Fora de escopo

- Cotação do dólar real (API de câmbio). Nesta versão a taxa é fixa: US$ 1 = R$ 5.
- Atualizar o preço da Scryfall periodicamente. Vale o `usd` gravado no catálogo quando a carta foi baixada.
- Preço nas views Grid visual e Grid visual agrupada, e no canvas.
- Total do deck.
- Preço manual da carta (F-004 / US-004-10): continua no modal de detalhes, sem relação com o estimado.

## User stories

### US-019-01 — Preço estimado na linha

**Como** jogador **quero** ver quanto custa cada linha do deck **para** ter uma ideia do valor sem sair da lista.

Critérios de aceite:

- [x] O menu “Exibir” tem a opção “Preço estimado”, desligada por padrão.
- [x] Ligada, cada linha da view Texto mostra, numa coluna à direita, `quantidade × US$ × 5` no formato `R$ 0,00`.
- [x] Passar o mouse sobre o valor mostra a dica “Valor estimado”.
- [x] Sem preço em dólar para a carta, a linha mostra “—”, com a mesma dica.

### US-019-02 — Tags opcionais e coluna menor

**Como** jogador **quero** ligar ou desligar as bolinhas de tag **para** abrir espaço na linha para o preço.

Critérios de aceite:

- [x] O menu “Exibir” tem a opção “Tags”, desligada por padrão.
- [x] Ligada, as bolinhas aparecem à esquerda da quantidade, como hoje; desligada, a coluna some.
- [x] A coluna das tags fica mais estreita que antes.

### US-019-03 — Exibir na visualização

**Como** jogador **quero** as mesmas opções na visualização **para** ler o deck com preço sem entrar na edição.

Critérios de aceite:

- [x] A visualização (`/decks/[id]`) tem o menu “Exibir” ao lado de “Visualização”, com Custo de mana, Tags e Preço estimado.
- [x] A escolha é a mesma nas duas rotas (salva no navegador).

## Decisões (confirmadas com o usuário)

1. Feature nova F-019.
2. Taxa fixa: US$ 1 = R$ 5, até existir uma solução melhor.
3. Só na view Texto, nas duas rotas (edição e visualização). O “Exibir” passa a existir na visualização.
4. Custo de mana, Tags e Preço estimado começam desligados.
5. O valor da linha é o total: quantidade × preço de uma cópia.
6. Impressão sem `usd` (comum em impressões em português): usa o `usd` da impressão mais recente da mesma carta (`oracle_id`) que já está no catálogo. Sem nenhuma, mostra “—”.

## Regras

- O preço vem de `catalog_cards.filters->>'usd'` (Scryfall `prices.usd`, não foil).
- O cálculo é feito em centavos: `round(usd × 5 × 100) × quantidade`.
- Nenhuma opção do “Exibir” grava no deck; só muda o que a linha desenha.

## Superfície

- API: `GET /api/decks/[id]` devolve `usd` por carta (com o fallback da decisão 6).
- UI: `TextListOptions` (novas opções), `DeckCardView` (colunas da linha), `deck-detail.tsx` (Exibir nas duas rotas).
- Lógica: `src/lib/estimated-price.ts`.
- Dados: preferência em `localStorage` (`mtghelper.deck.textOptions`), sem migration.
- Teste: `tests/f019-preco-estimado.spec.ts`.

## Relação com outras features

- F-006: catálogo local, de onde vem o `usd`.
- F-011: a visualização ganha o “Exibir”.
- F-013: bolinhas de tag.
- F-017: menu “Exibir” e colunas da linha; as tags deixam de ser fixas.
