# F-013 — Tags de carta

## Objetivo

Marcar cartas do deck e da coleção com tags coloridas, guardadas numa coluna só para facilitar a busca.

## Escopo

- Coluna `tags` em `deck_cards` e `collection_items`.
- Cada tag tem nome (identificador) e cor.
- No grid visual, a quantidade é um selo preto com texto branco (`x4`), à direita da faixa do nome. A cor da tag pinta esse selo a 70%. Os três pontos ficam na vertical, na mesma linha, à esquerda e dentro da imagem. A carta sob o mouse fica por cima desses selos.
- No grid agrupado, a quantidade fica à esquerda do nome, saindo um pouco da carta para cima e para a esquerda. Os três pontos ficam no mesmo lugar do grid visual.
- Na lista, várias tags aparecem como bolinhas ao lado da quantidade.
- No menu da carta, escolher uma tag já usada ou criar uma nova numa modal.

## Fora de escopo

- Tag compartilhada entre deck e coleção.
- Renomear uma tag em todas as cartas de uma vez.

## User stories

### US-013-01 — Ver tags na carta

**Como** jogador **quero** ver bolinhas coloridas ao lado da quantidade **para** saber de quais tags a carta faz parte.

Critérios de aceite:

- [x] No grid, o quadrado da quantidade pinta a cor da tag a 70% de opacidade. Mais de uma cor divide o quadrado em faixas iguais.
- [x] A quantidade e os três pontos usam o selo preto de texto branco, à direita da faixa do nome.
- [x] Na lista, cada tag vira uma bolinha da cor dela, ao lado do número de quantidade.
- [x] A bolinha mostra o nome da tag ao pairar.

### US-013-02 — Aplicar tag existente ou nova

**Como** jogador **quero** marcar a carta pelo menu **para** organizar deck e coleção sem sair da lista.

Critérios de aceite:

- [x] O menu da carta lista as tags já usadas naquele deck ou naquela coleção.
- [x] Clicar numa tag existente adiciona ou tira ela da carta.
- [x] “Nova tag…” abre uma modal com nome e cor.
- [x] O nome identifica a tag: o mesmo nome reutiliza a cor já usada naquele deck ou coleção.
- [x] A carta não é gravada com duas tags de mesmo nome.

### US-013-03 — Filtrar o deck por tag

**Como** jogador **quero** escolher uma tag numa lista com as cores **para** ver só as cartas do deck marcadas com ela.

Critérios de aceite:

- [x] Na edição, um botão de ícone “Tags” fica logo abaixo do botão “Gráficos”, na coluna de botões à direita.
- [x] Na visualização, a mesma coluna de botões aparece só com o botão “Tags”.
- [x] O botão abre um painel com as tags usadas no deck, cada uma com a bolinha da sua cor e o nome.
- [x] Clicar numa tag filtra “No deck”, “Sideboard” e “Fora do deck”: só aparecem as cartas com aquela tag.
- [x] Uma tag por vez: clicar em outra troca o filtro; clicar na tag ativa desliga o filtro.
- [x] “Limpar filtro” volta a mostrar todas as cartas.
- [x] Deck sem tags mostra um aviso no painel em vez da lista.

Decisões (confirmadas com o usuário):

1. O filtro vale na edição e na visualização.
2. Uma tag por vez.
3. O filtro atinge “No deck”, “Sideboard” e “Fora do deck”. Os gráficos, o tamanho do deck e os totais dos painéis continuam contando o deck inteiro.
4. O filtro é só da lista; o canvas (F-008) não é filtrado. O filtro não é salvo: recarregar a página mostra o deck inteiro.

## Regras

- Formato da coluna: `Nome|#rrggbb` separado por vírgula. Exemplo: `Ramp|#16a34a,Draw|#2563eb`.
- Nome com até 32 caracteres, sem vírgula e sem `|`.
- Cor em hexadecimal de 6 dígitos.
- A busca da coleção também olha o nome da tag.
- Filtro do deck (US-013-03): fica só no cliente. Com o filtro ativo, a barra de agrupamento mostra “Filtrando pela tag X”; painel sem cartas com a tag mostra “Nenhuma carta com a tag X.”. Se a tag some do deck, o filtro desliga.
- A tela do deck tem recuo à direita para a coluna de botões fixa não cobrir os controles.

## Testes

- `tests/f013-tags.spec.ts`: US-013-01 e US-013-02.
- `tests/f013-tag-filter.spec.ts`: US-013-03 na edição e na visualização.

## Superfície

- UI: menu da carta no deck, cartas da coleção, bolinhas ao lado da quantidade, botão/painel “Tags” do deck (`src/components/deck-detail/deck-tag-filter.tsx`, `deck-detail.tsx`)
- API: `PATCH /api/decks/[id]/cards` e `PATCH /api/collections/[id]/cards` com `tags`
- Dados: `deck_cards.tags`, `collection_items.tags`
