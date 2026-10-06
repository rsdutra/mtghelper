# F-004 — Cadastro de deck

## Objetivo

Criar e editar decks por formato, adicionar cartas (individual ou lista), marcar o que está **no deck** vs **em trabalho**, organizar com seções (tags) e visualizar em lista ou canvas.

## Modelo de dados (atual)

- Uma linha em `deck_cards` por carta (`UNIQUE (deck_id, catalog_card_id)`).
- Na interface, o lugar `out` (antes “Fora do deck”) se chama **Maybeboard** (F-018 / US-018-03).
- Editar Deck, Sideboard e Maybeboard de uma vez por texto: F-018.
- `quantity_main`, `quantity_side` e `quantity_out` guardam as cópias de cada lugar. A mesma carta pode estar no deck, no sideboard e fora ao mesmo tempo.
- Importar uma lista soma só a coluna do destino. Preço e nota são da carta. Tags também são da carta.
- O spot (F-012) usa só as cópias de `quantity_main`.

Histórico, já substituído:

- Uma linha em `deck_cards` por carta do workspace do deck.
- `included = true` → faz parte do deck (conta no Processar coleção, lista “No deck”).
- `included = false` → carta em trabalho (upgrade / cortar / considerar); ainda ligada ao deck, mas não “entra” na lista principal.
- Seções (`deck_sections`) são **tags** via `deck_card_sections` (N:N). Uma carta pode ter 0..N seções, independente de `included`.
- Cartas **não saem** de “No deck” / “Em trabalho” ao receber tag: a sessão é referência, não inventário paralelo.
- `deck_sections.kind`: `'user'` (tags manuais), `'type'` (agrupar por tipo) ou `'cost'` (agrupar por CMC).
- Impacto: seções **não** são mais inventário separado; não duplicam quantidade. Atribuir sessão = adicionar tag; **`included` só muda se o jogador desligar “No deck” manualmente**.
- Agrupar por tipo/custo **não** atribui seção automática a cartas que já têm tag `kind=user`.
- Desligar agrupamento **apaga só** seções `type`/`cost` correspondentes; **não** apaga `deck_cards`.

## Escopo

- CRUD de deck (criar, listar, editar nome/formato).
- Formatos: Commander, Modern, Legacy, Standard, Pauper, etc.
- Adicionar cartas via F-001 e F-002 (default `included=true`; na seção default `included=false` + tag).
- Toggle `included` por carta.
- Quantidade com + / − / lixeira.
- Seções como tags (criar, marcar, filtrar).
- Agrupar lista por tipo (US-004-07).
- Charts de distribuição por tipo e curva de mana (US-004-09) — só cartas `included=true`. Cores de mana (símbolos e terrenos): F-015.
- Conferência com a coleção na abertura do deck (US-004-17) — só `included=true`, todas as coleções, qualquer impressão (`oracle_id`).
- Adicionar à coleção as cartas que faltam, pelo aviso de cópias faltando (US-004-19).
- Checkbox “incluir na coleção” + Processar (**só `included=true`**).
- Exportar lista em texto (tudo / no deck / em trabalho) — US-004-15. Substituída pelo painel de exportação da F-016.
- Canvas: ver F-008.

## Fora de escopo

- Validação legal de formato (banlist).
- Multiplayer / compartilhamento.

## User stories

### US-004-01 — Criar e excluir deck

**Como** jogador **quero** criar e excluir decks **para** manter só os que uso.

Critérios de aceite:

- [x] Criar deck com nome + formato.
- [x] Listagem com link para o deck.
- [x] Excluir deck na listagem (confirmação); CASCADE remove cartas, seções e canvas.

### US-004-02 — Adicionar cartas
- [x] Resolvedor compartilhado; quantidades somam na mesma linha.

### US-004-18 — Adicionar carta pela busca com botão

**Como** jogador **quero** escolher a carta e o destino antes de adicionar **para** não incluir a carta errada só por clicar numa sugestão.

Critérios de aceite:

- [x] Na edição, clicar numa sugestão da busca só seleciona a carta; nada é gravado.
- [x] A carta selecionada aparece abaixo da busca, com miniatura, nome e um botão para limpar a seleção.
- [x] O botão **Adicionar** fica onde estava “Escanear carta” e só habilita com uma carta selecionada.
- [x] Clicar em **Adicionar** grava 1 cópia no destino do seletor (No deck, Sideboard ou Fora do deck) e limpa a seleção.
- [x] O botão “Escanear carta” sai da edição do deck. O escaneamento continua na coleção (F-007).
- [x] O seletor de destino (Deck / Side / Fora) fica ao lado do botão **Adicionar**, não mais colado ao campo de busca, porque é o botão que usa o destino. A funcionalidade não muda.
- [x] **Adicionar** e o seletor formam um botão dividido (sem espaço entre eles, borda contínua). O seletor mostra uma seta para baixo que vira para cima com o menu aberto.

Testes: `tests/f004-busca-adicionar.spec.ts`; `tests/f007-scan.spec.ts` confere que o deck não tem mais o botão e que a coleção ainda abre o scanner.

### US-004-08 — Incluída no deck (boolean)

**Como** jogador **quero** marcar se a carta está no deck ou só em trabalho **para** planejar upgrades sem poluir a lista oficial.

Critérios de aceite:

- [x] Campo `included` em `deck_cards`.
- [x] UI permite ligar/desligar inclusão.
- [x] Lista separa ou destaca “No deck” vs “Em trabalho”.
- [x] Processar coleção usa apenas `included=true`.

### US-004-03 — Seções como tags (revisão)

**Como** jogador **quero** etiquetar cartas (upgrade, cortar, trocar…) **para** organizar o trabalho sem inventário paralelo.

Critérios de aceite:

- [x] Seção tem nome livre.
- [x] Tag N:N em `deck_card_sections` (não tabela de quantidades separada).
- [x] Posso adicionar carta já com uma tag / `included=false`.
- [x] Posso atribuir/remover tag sem apagar a carta do workspace.
- [x] Posso **deletar** uma tag `kind=user` (remove só a seção e vínculos; cartas permanecem).
- [x] Tags `kind=type` não são deletáveis pela UI (só via toggle agrupar por tipo).
- [x] Mover para seção **não** desliga `included` automaticamente (só o checkbox “No deck”).

### US-004-12 — Multiselect de sessões na listagem

**Como** jogador **quero** escolher uma ou mais sessões (tags) por carta na listagem **para** referenciar a carta em várias sessões sem tirá-la de “No deck” ou “Em trabalho”.

Critérios de aceite:

- [x] Dropdown multiselect por carta na listagem (só seções `kind=user`).
- [x] Atribuir/remover tags **não** altera `included` nem remove a carta das listas “No deck” / “Em trabalho”.
- [x] Uma carta pode ficar em 0..N sessões (referência N:N).
- [x] Tags automáticas `type`/`cost` não entram no multiselect e não são apagadas ao sincronizar tags user.

### US-004-06 — Remover cartas
- [x] + / − / lixeira no workspace unificado.

### US-004-07 — Agrupar por tipo

**Como** jogador **quero** agrupar a lista “No deck” por tipo de carta **para** revisar o deck mais rápido.

Critérios de aceite:

- [x] Toggle “Agrupar por tipo” na lista (só cartas `included=true`).
- [x] Cada grupo de tipo é **colapsável** (expandir/recolher o bloco).
- [x] O mesmo toggle aparece no canvas (ver US-008-03).
- [x] Preferência do toggle persiste em `localStorage`.
- [x] Cartas com sessão `user` **não** recebem tag automática de tipo.

### US-004-11 — Agrupar por custo (CMC)

**Como** jogador **quero** agrupar por custo de mana **para** revisar a curva na lista e no canvas.

Critérios de aceite:

- [x] Toggle “Agrupar por custo” (exclusivo com “por tipo”).
- [x] Lista colapsável por CMC 0–6 e 7+.
- [x] Canvas cria seções `kind=cost`; desligar remove só essas.
- [x] Cartas com sessão `user` **não** são movidas/retagadas.

### US-004-09 — Charts de tipo e mana

**Como** jogador **quero** ver distribuição por tipo e curva de mana na lista do deck **para** balancear o deck rapidamente.

Critérios de aceite:

- [x] Pie chart de tipos (contagem × quantidade) só com cartas `included=true`.
- [x] Bar chart de mana value 0–6 e 7+; terrenos excluídos da curva.
- [x] CMC derivado de `mana_cost` (sem coluna `cmc` no banco).
- [x] Charts na tela de listagem do deck (`/decks/[id]` modo Lista).

### US-004-13 — Miniatura na listagem do deck

**Como** jogador **quero** ver a arte da carta ao lado do nome na lista **para** reconhecer cartas mais rápido.

> Substituída por F-010: a view Texto não mostra miniatura; a arte fica nas views Grid visual e Grid visual agrupada.

Critérios de aceite:

- [x] Thumbnail (`image_small`, fallback `image_normal`) ao lado do nome em “No deck” e “Em trabalho”.
- [x] Placeholder se a carta não tiver imagem.
- [x] Miniatura permanece visível com agrupamento por tipo ou custo.

### US-004-14 — Preview ampliado na listagem

**Como** jogador **quero** ampliar a carta ao pairar o mouse na lista **para** conferir arte/texto como no canvas (US-008-04).

> Atualizada por F-010 / US-010-05: preview compartilhado entre as views, com delay de ~300 ms e posicionado ao lado do cursor/carta.

Critérios de aceite:

- [x] Manter o mouse ~1s sobre a miniatura/nome mostra preview grande na posição do cursor.
- [x] O preview acompanha o cursor; sair da carta esconde; trocar de carta reinicia o delay.
- [x] Usa `image_normal` (fallback: `image_small` com `/small/` → `/normal/`).

### US-004-10 — Preço e nota na carta do deck

**Como** jogador **quero** registrar preço (R$) e nota rica por carta **para** anotar custo e observações.

Critérios de aceite:

- [x] Campos `price_cents` e `note` em `deck_cards`.
- [x] Ícone de olho na linha da carta abre o modal (preço/nota hoje; outros dados da carta no futuro).
- [x] PATCH via `/api/decks/[id]/cards`.

### US-004-16 — Linha compacta na listagem

**Como** jogador **quero** controles de quantidade discretos e um ícone de detalhes **para** ler a lista com menos ruído.

Critérios de aceite:

- [x] + / − / excluir menores e com estilo muted na linha da carta.
- [x] Olho substitui o texto “Preço / Nota” e reabre o mesmo modal de detalhes.

### US-004-15 — Exportar lista do deck

**Como** jogador **quero** exportar o deck em texto (`quantidade nome_en`) **para** colar em Arena, Moxfield ou outra ferramenta.

Critérios de aceite:

- [x] Botão “Exportar” na tela do deck (`/decks/[id]`) com dropdown.
- [x] Opções: Exportar tudo · Exportar somente no deck · Exportar somente em trabalho.
- [x] Cada opção gera só o conjunto correspondente, uma linha `quantidade nome` (inglês).
- [x] Lista copiável (clipboard + textarea).

> Substituída pela F-016: o botão do cabeçalho saiu e a exportação (Deck, Sideboard, Fora do deck, Tudo) fica no painel à direita.

### US-004-17 — Conferência deck × coleção

**Como** jogador **quero** ver, ao abrir o deck, se tenho as cartas **No deck** na coleção **para** saber o que falta comprar.

Critérios de aceite:

- [x] Cálculo no `GET /api/decks/[id]` (não persistido; não job periódico).
- [x] Só cartas `included=true`.
- [x] Soma **todas** as coleções do usuário.
- [x] Casa por `oracle_id` (qualquer set); sem oracle, cai no `catalog_card_id`.
- [x] Resumo no header: “Coleção: completo” ou “Faltam N cópias · M cartas”.
- [x] Na linha incluída: `possuídas/necessárias`.

### US-004-19 — Adicionar as cartas faltantes à coleção

**Como** jogador **quero** clicar no aviso “Faltam N cópias” e adicionar à coleção as cartas que faltam **para** completar a coleção sem digitar a lista.

Critérios de aceite:

- [x] Quando faltam cópias, o aviso “Faltam N cópias · M cartas” é um botão (lista e canvas, edição e visualização).
- [x] Clicar abre um modal com as cartas que faltam, em texto: `quantidade_faltante nome`, uma por linha, com um checkbox ao lado de cada uma.
- [x] Todos os checkboxes vêm marcados; um checkbox “Marcar todas” marca ou desmarca todos.
- [x] O botão “Adicionar à coleção” adiciona as cartas marcadas; fica desabilitado sem nenhuma marcada.
- [x] Depois de adicionar, o modal fecha e a conferência do deck é recalculada (o aviso atualiza ou vira “Coleção: completo”).
- [x] “Coleção: completo” continua só informativo.

Regras:

- Mesma conta da US-004-17: só “No deck” + Sideboard, todas as coleções, casando por `oracle_id`. Uma linha por carta (a mesma carta no deck e no sideboard soma).
- Quantidade adicionada = faltantes (necessárias − possuídas), sem edição.
- Entra na coleção padrão (a primeira do usuário), como o Processar coleção (US-004-04).
- Impressão: a mais recente do catálogo para aquele `oracle_id` (igual à importação de lista da coleção); sem `oracle_id`, a impressão que está no deck.
- O servidor recalcula as faltantes na hora de gravar; não confia na quantidade enviada pela tela.
- Vale na visualização: grava na coleção, não no deck (a regra da F-011 de não gravar vale para o deck).

Decisões (confirmadas com o usuário): user story na F-004; coleção padrão; quantidade = faltantes; todas marcadas; edição e visualização; impressão mais recente.

Testes: `tests/f004-cartas-faltantes.spec.ts` — lista (soma deck + sideboard, ignora “Fora do deck” e o que já tem), marcar/desmarcar, adicionar só as marcadas, impressão mais recente, aviso atualizado, visualização.

Superfície: `src/components/deck-coverage-badge.tsx` (botão), `src/components/deck-detail/deck-missing-cards.tsx` (modal), `missingCardList` em `src/lib/deck-coverage.ts`, `POST /api/decks/[id]/missing-cards`, consulta compartilhada em `src/lib/deck-coverage-db.ts`.

### US-004-04 — Processar para coleção
- [x] Só cartas `included=true`.

### US-004-05 — Entrada no canvas
- Ver F-008 (layout + sync de ações).

## Superfície

- UI: `/decks`, `/decks/[id]` (visualização) e `/decks/[id]/edit` (edição — F-011)
- API: `/api/decks`, `/api/decks/[id]`, `.../cards`, `.../sections` (POST/DELETE), `.../process-collection`, `.../missing-cards` (US-004-19)
- Dados: `decks`, `deck_cards` (+ `included`), `deck_sections` (+ `kind` / `type_key`), `deck_card_sections`
- API: `POST /api/decks/[id]/type-sections` `{ enabled }` — cria/sincroniza ou remove seções `kind=type`
