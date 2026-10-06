# F-017 — Lista da edição no estilo Moxfield

## Objetivo

Na edição do deck, a view Texto lista as cartas pelo nome, como a visualização, com preview fixo ao lado e as ações de edição num ícone.

## Escopo

- View Texto da edição em colunas de quantidade + nome, sem miniatura e sem preview flutuante ao pairar — US-017-01.
- Preview fixo à esquerda da lista, que acompanha a carta sob o cursor — US-017-01.
- Ícone de opções em cada linha, abrindo as ações de edição que já existem — US-017-02.
- Dropdown de múltipla escolha “Exibir”, ao lado de “Visualização”, com a opção “Custo de mana” — US-017-03.
- Bolinhas das tags ao lado da quantidade — US-017-04.

## Fora de escopo

- Preview ao pairar na visualização, na grid e na grid agrupada (F-010 / F-011).
- Preço na linha. O Moxfield mostra preço; nesta versão a única opção de “Exibir” é o custo de mana.
- Canvas (F-008).

## User stories

### US-017-01 — Lista por nome com preview ao lado

**Como** jogador **quero** ler o deck na edição como no Moxfield **para** ver muitas cartas e a imagem da carta que estou olhando.

Critérios de aceite:

- [x] Na edição, a view Texto usa colunas de quantidade + nome, iguais às da visualização. Sem miniatura na linha.
- [x] O preview que segue o cursor não aparece nessa view. Grid, grid agrupada e a visualização continuam com ele.
- [x] Um painel fixo à esquerda mostra a carta. Ele troca quando o cursor entra na linha e permanece na última carta.
- [x] Sem carta sob o cursor, o painel pede para passar o cursor sobre uma carta.

### US-017-02 — Ícone de opções

**Como** jogador **quero** um ícone na linha **para** abrir as ações de edição sem ocupar a lista.

Critérios de aceite:

- [x] Cada linha da view Texto na edição tem um ícone de opções, visível só com o cursor na linha (ou com o menu aberto).
- [x] O menu traz as ações atuais: aumentar, diminuir, remover todas, detalhes, copiar nome, mover (fora do deck, no deck, sideboard quando o formato permite) e tags.
- [x] Aumentar, diminuir e remover todas ficam numa única linha de ícones no topo do menu (+, − e lixeira), com dica ao passar o mouse e os mesmos rótulos acessíveis.

### US-017-03 — Itens opcionais da lista

**Como** jogador **quero** ligar ou desligar dados extras na linha **para** deixar a lista mais densa ou mais informada.

Critérios de aceite:

- [x] Na edição, ao lado do dropdown “Visualização”, há o dropdown “Exibir”, de múltipla escolha.
- [x] A opção “Custo de mana” começa desligada. Marcar mostra os símbolos do custo depois do nome; desmarcar esconde.
- [x] A escolha fica salva no navegador.
- [x] A opção vale para a view Texto. A visualização não ganha esse dropdown.

> Atualizada pela F-019: o “Exibir” ganhou “Tags” e “Preço estimado” (todas começam desligadas) e passou a existir também na visualização.

### US-017-04 — Indicador de tags

**Como** jogador **quero** ver as tags na lista compacta **para** reconhecer a função da carta sem abrir o menu.

Critérios de aceite:

- [x] Cada tag da carta aparece como bolinha da cor dela, à esquerda da quantidade. A coluna da quantidade e a do custo de mana ficam alinhadas entre as linhas.

> Atualizada pela F-019 / US-019-02: as bolinhas só aparecem com “Tags” ligado no “Exibir”, numa coluna mais estreita (1.75rem).

## Decisões

1. Só a view Texto da rota de edição muda. A visualização (`/decks/[id]`) permanece como em F-011.
2. O painel lateral troca de carta no `pointerenter` da linha. Não há imagem flutuante seguindo o cursor.
3. “Exibir” começa sem opções marcadas. “Custo de mana” é a única opção desta versão. Os símbolos coloridos vêm dos svgs da Scryfall (`R.svg`, `G.svg`, …) e ficam numa coluna alinhada à direita do nome.
4. O custo usa `mana_cost` da carta, ou o custo da face da frente quando o outro vem vazio.
5. As ações da linha de texto da edição passam a ser o menu já usado na grid (`layout: "menu"`).

## Regras

- Nenhuma opção de “Exibir” grava carta. Só muda o que a linha desenha.
- Agrupar por tipo, custo ou tag continua valendo nessas colunas.
- Filtro por tag (F-013) continua valendo.

## Superfície

- UI: `/decks/[id]/edit` com view Texto; `DeckCardView`, `DeckSidePreview`, `TextListOptions`, símbolos em `ManaCost`.
- Teste: `tests/f017-lista-edicao.spec.ts`.
- API: nenhuma nova.
- Dados: preferência em `localStorage` (`mtghelper.deck.textOptions`).

## Relação com outras features

- F-010: grid e grid agrupada, e o preview ao pairar fora desta view.
- F-011: a visualização condensada é a referência da linha; a edição deixa de usar a linha com miniatura.
- F-013: bolinhas de tag e o menu de tags.
- F-016: “Copiar nome” continua no menu da carta.
