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

## Regras

- Rate limit: search/named/collection ≤ ~2/s; autocomplete mais permissivo.
- JSON de carta pode/deve viver ≥ 24h; na prática fica até limpeza futura.
- Dados Scryfall não podem ficar atrás de paywall.

## Superfície

- Lib: `src/lib/scryfall.ts`, `src/lib/cards.ts`, `src/lib/db.ts`
- SQL: `sql/schema.sql` → `catalog_cards`
- Docs: `docs/scryfall-api.md`
