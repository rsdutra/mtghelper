# F-005 — Cadastro de coleção

## Objetivo

Registrar a coleção física do jogador, com set opcional; se omitido, usar a impressão mais recente.

## Escopo

- Listar/criar coleções do usuário.
- Coleção padrão criada no registro (F-003).
- Adicionar cartas via F-001 e F-002.
- Campo opcional de set (`mh3`, etc.).
- Sem set → impressão mais recente (`released_at` / lookup Scryfall).
- Integração com Processar do deck (F-004 / US-004-04).
- Busca local na coleção, seção colapsável de adição e views grade/lista (US-005-06).
- Filtros Scryfall aplicados só aos itens desta coleção (US-005-07).

## Fora de escopo

- Condição (NM/LP), foil/non-foil separado, idioma da cópia física.
- Valoração agregada da coleção em tempo real.
- Sincronização com marketplaces.

## User stories

### US-005-01 — Ver e criar coleções

**Como** jogador **quero** ter ao menos uma coleção **para** guardar o que possuo.

Critérios de aceite:

- [x] Registro cria "Minha coleção".
- [x] Posso criar coleções adicionais com nome.
- [x] Listagem mostra quantidade total de cartas.
- [x] Posso **deletar** uma coleção (itens em CASCADE); não posso apagar a última coleção do usuário.

### US-005-02 — Adicionar com set explícito

**Como** jogador **quero** informar o set **para** cadastrar a impressão correta.

Critérios de aceite:

- [ ] Com `set` informado, resolve contra esse código quando possível.
- [ ] Quantidades somam no mesmo `catalog_card_id`.

### US-005-03 — Default impressão mais recente

**Como** jogador **quero** omitir o set **para** cair na impressão mais atual automaticamente.

Critérios de aceite:

- [ ] Sem set, após resolver o nome, escolhe a printing mais recente do `oracle_id`.
- [ ] Carta fica no catálogo (F-006) e na coleção.

### US-005-04 — Visualizar itens

**Como** jogador **quero** ver grade com imagem, nomes e set **para** conferir o inventário.

Critérios de aceite:

- [x] Lista itens com quantidade, PT/EN e set.
- [x] Mostra imagem quando URI existir.

### US-005-05 — Preço e nota na coleção

**Como** jogador **quero** preço (R$) e nota por item da coleção **para** acompanhar valor e comentários.

Critérios de aceite:

- [x] Campos `price_cents` e `note` em `collection_items`.
- [x] Modal “Preço / Nota” na grade da coleção.
- [x] PATCH via `/api/collections/[id]/cards`.

### US-005-06 — Busca, edição colapsável e view lista

**Como** jogador **quero** filtrar o que já tenho, esconder as ferramentas de adição e alternar grade/lista **para** revisar o acervo mais rápido.

Critérios de aceite:

- [x] Campo “Buscar na coleção” filtra só os itens desta coleção (nome PT/EN e set), sem Scryfall.
- [x] Busca, scan e lista de adição ficam numa seção colapsável “Editar coleção” (fechada por padrão).
- [x] Toggle Grade / Lista; a lista mostra miniatura, quantidade, nomes e set.
- [x] Preferência da view persiste em `localStorage`.

### US-005-07 — Filtros Scryfall na coleção

**Como** jogador **quero** filtrar o acervo com a sintaxe Scryfall **para** achar cartas que já possuo sem buscar o catálogo inteiro.

Critérios de aceite:

- [x] Seção “Filtros” em `/colecao/[id]` (sintaxe + atalhos de cor, tipo, CMC, raridade, formato e set).
- [x] O filtro aplica-se **somente** às cartas desta coleção (AND com a busca local por nome/set).
- [x] Metadados Scryfall ficam em `catalog_cards.filters` (jsonb); a primeira abertura hidrata o que faltar via `/cards/collection`.
- [x] Não chama `/cards/search` contra o jogo inteiro para filtrar a coleção.

## Regras

- Coleção sempre ligada ao usuário autenticado.
- Não misturar cartas de seção de deck ao processar (V1).
- Conferência do deck (F-004 / US-004-17) lê **todas** as coleções do usuário e agrupa por `oracle_id`.

## Superfície

- UI: `/colecao`, `/colecao/[id]`
- API: `/api/collections`, `/api/collections/[id]`, `.../cards`
- Dados: `collections`, `collection_items`; metadados de filtro em `catalog_cards.filters` (F-006)

## Notas (US-005-07)

Sintaxe local cobre os operadores comuns da Scryfall (`c`/`id`/`ci`, `t`, `o`, `kw`, `m`/`mv`/`cmc`, `pow`/`tou`/`loy`, `r`, `e`/`s`, `cn`, `f`/`banned`/`restricted`, `a`, `year`/`date`, `lang`, `produces`, `usd`/`eur`/`tix`, `frame`/`border`/`game`/`in`, `is`/`not`, `ft`, `!` nome exato, `or`, `-`, aspas). `include:`, `unique:`, `order:` e `direction:` são ignorados (a coleção já é o universo). Tags de oracle/artista, cubes e tipos de set (`st:`) ficam de fora nesta versão.
