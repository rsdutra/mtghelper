# F-016 — Exportação do deck

## Objetivo

Reunir num painel lateral próprio a exportação das listas do deck (Deck, Sideboard, Fora do deck e Tudo) e permitir copiar o nome de uma carta direto do menu dela.

## Escopo

- Novo botão de ícone “Exportar” na coluna de botões à direita da tela do deck, abrindo um painel lateral — US-016-01.
- Exportar separadamente Deck, Sideboard, Fora do deck e Tudo — US-016-01.
- “Copiar nome” no menu da carta, na edição e na visualização — US-016-02.
- Substitui o botão “Exportar” do cabeçalho (US-004-15), que sai da tela de lista e do canvas.

## Fora de escopo

- Formatos com set/número de coleção, MTGO `.dek`, CSV ou arquivo para download.
- Exportar a partir do canvas (o canvas não tem a coluna de botões; fica para depois).
- Copiar o nome em português.

## User stories

### US-016-01 — Painel de exportação

**Como** jogador **quero** exportar separadamente o deck, o sideboard e as cartas fora do deck **para** colar cada lista em outra ferramenta.

Critérios de aceite:

- [x] Botão de ícone “Exportar” na coluna de botões à direita, abaixo de “Ferramentas de construção”, na edição e na visualização.
- [x] O botão abre e fecha um painel lateral com um botão por opção: Deck, Sideboard, Fora do deck e Tudo.
- [x] “Sideboard” só aparece quando o formato tem sideboard.
- [x] Cada opção exporta só o seu conjunto, uma linha `quantidade nome_em_inglês`, ordenada pelo nome.
- [x] Clicar numa opção copia a lista para a área de transferência e abre um modal com a lista e o botão “Copiar”.
- [x] Conjunto vazio mostra “Nenhuma carta para exportar.” no modal.
- [x] O botão “Exportar” do cabeçalho não aparece mais (lista e canvas).

### US-016-02 — Copiar nome da carta

**Como** jogador **quero** copiar o nome de uma carta pelo menu dela **para** colar em uma busca ou conversa.

Critérios de aceite:

- [x] Na edição, o menu de três pontos (grid e grid agrupada) tem o item “Copiar nome”.
- [x] Na edição, a visualização em texto tem um botão de ícone “Copiar nome de X” nas ações da linha.
- [x] Copia o nome em inglês da carta para a área de transferência.
- [x] Depois de copiar, aparece o aviso “Nome copiado” por alguns segundos.
- [x] Na visualização, as cartas têm o mesmo menu de três pontos, só com “Copiar nome”: na grid, na grid agrupada e no fim da linha da lista em texto.
- [x] Na lista em texto da visualização, os três pontos só aparecem com o mouse sobre a linha (ou com o menu aberto).

## Regras

- Deck = cartas em “No deck”. Em formato sem sideboard, cartas marcadas como sideboard contam como Deck (igual à lista da tela).
- Sideboard = cartas no sideboard (só formatos com sideboard).
- Fora do deck = cartas em “Fora do deck”.
- Tudo = todas as cartas do deck, dos três lugares, numa lista só. A mesma carta em lugares diferentes aparece uma vez por lugar.
- O filtro por tag (F-013) não muda a exportação.
- A montagem do texto fica numa função pura (`src/lib/deck-export.ts`).

## Decisões (confirmadas com o usuário)

1. O botão “Exportar” do cabeçalho sai; a exportação fica só no novo painel à direita.
2. Opções: Deck, Sideboard, Fora do deck e Tudo.
3. Cada opção copia para a área de transferência e abre o modal com a lista, como antes.
4. Formato mantido: `quantidade nome_em_inglês`.
5. “Copiar nome” copia o nome em inglês.
6. “Copiar nome” no menu da carta na edição e na visualização. Na visualização o menu de três pontos tem só essa opção, inclusive na lista em texto (pontos no fim da linha, ao pairar).
7. O botão do painel aparece na edição e na visualização.

## Testes

- `tests/f016-exportacao.spec.ts`:
  - Cálculo puro: conjuntos Deck, Sideboard, Fora do deck e Tudo; formato sem sideboard; ordenação.
  - Tela: botão abaixo de “Ferramentas de construção”, sem “Exportar” no cabeçalho, lista copiada de cada opção, Sideboard ausente em formato sem sideboard, visualização com o mesmo painel.
  - Copiar nome: item no menu de três pontos e botão na lista em texto, conteúdo da área de transferência e aviso “Nome copiado”.
  - Visualização: menu só com “Copiar nome” na lista em texto (pontos visíveis só ao pairar) e na grid.

## Superfície

- Lib: `src/lib/deck-export.ts`
- UI: `src/components/deck-export-menu.tsx` (painel e modal), botão e painel em `src/components/deck-detail/deck-detail.tsx`, “Copiar nome” em `src/components/deck-views/deck-card-actions.tsx` (edição e `DeckCardCopyActions` da visualização) e menu de três pontos em `src/components/deck-views/deck-card-view.tsx`
- API: nenhuma mudança
- Dados: nenhuma mudança

## Relação com outras features

- F-004 / US-004-15: exportação original no cabeçalho, substituída por esta feature.
- F-010: visualizações texto, grid e grid agrupada (onde fica o menu da carta).
- F-011: telas de visualização e edição do deck.
- F-013: filtro por tag (não afeta a exportação).
