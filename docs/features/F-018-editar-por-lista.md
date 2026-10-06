# F-018 — Editar o deck por lista

## Objetivo

Editar o deck, o sideboard e o Maybeboard (antigo “Fora do deck”) num texto `quantidade nome`, e ao salvar o deck fica igual ao que está no texto.

## Escopo

- Botão **Editar por lista** ao lado do seletor de visualização — US-018-01.
- Texto carregado com as cartas atuais, uma por linha: `quantidade nome` — US-018-01.
- Nome em inglês ou português na hora de salvar — US-018-02.
- Salvar substitui o conteúdo do deck pelo texto: entra o que é novo, muda a quantidade do que mudou, sai o que não está mais na lista — US-018-02.
- “Fora do deck” passa a se chamar **Maybeboard** em toda a interface — US-018-03.

## Fora de escopo

- Escolher a impressão (set) da carta pelo texto.
- Editar tags, preço ou nota pelo texto.
- Mudar o lugar `out` no banco: só o rótulo muda.

## User stories

### US-018-01 — Abrir a edição por lista

**Como** jogador **quero** ver o deck inteiro em texto **para** editar muitas cartas de uma vez, como no Moxfield.

Critérios de aceite:

- [x] Na edição, ao lado do seletor “Visualização”, há o botão **Editar por lista**. Ele fica desabilitado até as cartas do deck carregarem.
- [x] O botão abre um editor com o Deck, o Sideboard (quando o formato permite) e o Maybeboard, cada um com as cartas atuais, uma por linha: `quantidade nome`.
- [x] Cancelar fecha o editor sem gravar nada.

### US-018-02 — Salvar a lista

**Como** jogador **quero** salvar o texto editado **para** o deck ficar igual à lista.

Critérios de aceite:

- [x] Aceita `quantidade nome` com o nome em inglês ou em português (mesmo resolvedor das outras listas, F-002).
- [x] Carta nova no texto entra no lugar correspondente; quantidade alterada é atualizada; carta que saiu do texto sai daquele lugar.
- [x] Carta que continua no deck mantém impressão, tags, preço e nota.
- [x] Linhas repetidas da mesma carta no mesmo lugar somam.
- [x] Nome não reconhecido: nada é gravado e o editor aponta o lugar, a linha e o nome.
- [x] Depois de salvar, o editor fecha e a lista, a conferência com a coleção e os gráficos atualizam.

### US-018-03 — Fora do deck vira Maybeboard

**Como** jogador **quero** o nome usado no Moxfield **para** reconhecer a seção.

Critérios de aceite:

- [x] Painel, menu da carta, destino do Adicionar, Adicionar lista, Incluir na coleção e exportação mostram “Maybeboard” no lugar de “Fora do deck”. O canvas não tem rótulo de lugar.

## Decisões (confirmadas com o usuário)

1. O botão só aparece na edição (`/decks/[id]/edit`). A visualização continua sem gravar (F-011).
2. Editor em modal grande, com abas Deck · Sideboard · Maybeboard e um texto por lugar, como o “Adicionar lista”.
3. Os nomes carregados vêm em inglês, ordenados pelo nome, igual à exportação (F-016). Ao salvar, inglês e português valem.
4. Nome não reconhecido: nada é gravado, o editor continua aberto e lista os nomes com problema (com a aba de cada um).
5. “Fora do deck” vira “Maybeboard” em toda a interface.

## Regras

- O banco continua com `quantity_main`, `quantity_side` e `quantity_out`. Maybeboard = `quantity_out`.
- A carta que já está no deck é reconhecida pelo nome (inglês, português ou uma das faces) antes de consultar o resolvedor, para não trocar a impressão. Com duas impressões do mesmo nome, vale a que já está naquele lugar.
- Os nomes são todos resolvidos antes de gravar; a gravação é uma transação única.
- Sem sideboard no formato, o Sideboard não aparece no editor e o que estava nele entra no Deck (igual à exportação).

## Superfície

- UI: botão na barra da lista em `deck-detail.tsx`; modal `src/components/deck-detail/deck-list-editor.tsx`.
- API: `PUT /api/decks/[id]/cards` `{ lists: { main, side, out } }`. Responde 422 com `missing: [{ place, name, line }]` quando algum nome não é reconhecido.
- Lógica pura: `src/lib/deck-list-edit.ts` (casamento por nome e soma por lugar).
- Dados: `deck_cards` (sem migration).
- Teste: `tests/f018-editar-por-lista.spec.ts`.

## Relação com outras features

- F-002: parser e resolvedor de lista.
- F-004: lugares Deck / Sideboard / Maybeboard e importação que soma.
- F-011: barra da lista na edição.
- F-016: exportação no mesmo formato `quantidade nome`; a opção “Fora do deck” virou “Maybeboard”.
