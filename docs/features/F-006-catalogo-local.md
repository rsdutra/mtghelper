# F-006 — Catálogo local de cartas

## Objetivo

Manter cópia persistente das impressões usadas pelo app para responder rápido e reduzir chamadas à Scryfall.

## Escopo

- Tabela `catalog_cards` com id Scryfall, oracle, nomes EN/PT, set, imagens, metadados.
- Coluna `filters jsonb` com snapshot Scryfall para filtrar coleção (F-005 / US-005-07).
- Upsert ao buscar/resolver cartas (F-001, F-002).
- Busca local por `name_en` / `name_pt` antes da API.
- Cliente Scryfall no servidor com User-Agent, fila de rate limit e cache implícito via DB.
- Persistência: **não** é cache de sessão; limpeza só de lixo operacional (não implementada na V1).

## Fora de escopo

- Importação bulk completa da Scryfall (planejada depois).
- Armazenar arquivos de imagem no disco/S3.
- Preços em tempo real.

## User stories

### US-006-01 — Resolver com preferência local

**Como** sistema **quero** consultar o Postgres antes da Scryfall **para** respeitar rate limit e latência.

Critérios de aceite:

- [ ] Match exato local por nome EN ou PT evita named remoto.
- [ ] Miss local dispara Scryfall e grava o resultado.

### US-006-02 — Upsert de impressão

**Como** sistema **quero** salvar/atualizar a impressão **para** reutilizar depois.

Critérios de aceite:

- [ ] `scryfall_id` é único.
- [ ] `name_pt` preenchido quando disponível.
- [ ] URIs `small`/`normal` gravadas quando existirem (inclui faces DFC).
- [x] Upsert grava/atualiza `filters` (tipo, oracle, cores, legalities, etc.).

### US-006-03 — Impressão mais recente

**Como** F-005 **quero** obter a printing mais nova de um `oracle_id` **para** default de coleção.

Critérios de aceite:

- [ ] Ordena por `released_at` desc no catálogo.
- [ ] Se insuficiente, busca prints na Scryfall e upserta.

### US-006-04 — Metadados sempre em inglês

**Como** jogador **quero** que a carta encontrada pelo nome em português guarde os dados da impressão em inglês **para** ter preço (a Scryfall não dá preço para impressões em português) e o nome em português só na tela.

Critérios de aceite:

- [x] Sugestão da busca, resolução de nome (lista, scanner, busca) e impressão mais recente gravam a impressão em inglês do mesmo set e número, com `name_pt` vindo do nome impresso em português.
- [x] Sem versão em inglês do mesmo set e número, usa a impressão em inglês que a Scryfall devolve pelo nome.
- [x] A busca local só devolve impressões em inglês; uma impressão em português gravada antes não volta a entrar em deck ou coleção.
- [x] Ao abrir um deck ou uma coleção, cartas ligadas a uma impressão em português passam para a impressão em inglês do mesmo set e número. Quantidades, tags, preço manual e nota continuam. Se a impressão em inglês já estiver na mesma lista, as duas linhas se juntam.
- [x] No deck, o layout do canvas acompanha a troca.
- [x] A tela continua mostrando o nome em português quando existe; a imagem passa a ser a da impressão em inglês.

Decisões (confirmadas com o usuário): user story na F-006; converter as cartas antigas ao abrir o deck ou a coleção; mesma branch e PR da F-019, que depende do preço.

Teste: `tests/f006-metadados-ingles.spec.ts`.

## Regras

- Rate limit: search/named/collection ≤ ~2/s; autocomplete mais permissivo.
- O catálogo guarda impressões em inglês (US-006-04). O português fica só em `name_pt`.
- Converter ao abrir é manutenção de dados, não edição do jogador: vale também na visualização do deck (F-011).
- JSON de carta pode/deve viver ≥ 24h; na prática fica até limpeza futura.
- Dados Scryfall não podem ficar atrás de paywall.

## Superfície

- Lib: `src/lib/scryfall.ts`, `src/lib/cards.ts`, `src/lib/db.ts`
- SQL: `sql/schema.sql` → `catalog_cards`
- Docs: `docs/scryfall-api.md`
