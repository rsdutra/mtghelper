# Features

Cada mudança de produto neste repositório deve referenciar uma **feature** (`F-XXX`) ou uma **user story** (`US-XXX`) dentro dela.

| ID | Feature | Spec |
|---|---|---|
| F-001 | Motor de busca individual | [F-001-busca-individual.md](./F-001-busca-individual.md) |
| F-002 | Motor de busca por lista | [F-002-busca-lista.md](./F-002-busca-lista.md) |
| F-003 | Cadastro e autenticação | [F-003-auth.md](./F-003-auth.md) |
| F-004 | Cadastro de deck | [F-004-decks.md](./F-004-decks.md) |
| F-005 | Cadastro de coleção | [F-005-colecao.md](./F-005-colecao.md) |
| F-006 | Catálogo local de cartas | [F-006-catalogo-local.md](./F-006-catalogo-local.md) |
| F-007 | Escaneamento de cartas (OCR local) | [F-007-escaneamento-ocr.md](./F-007-escaneamento-ocr.md) |
| F-008 | Canvas de deck | [F-008-canvas-deck.md](./F-008-canvas-deck.md) |
| F-009 | UI / layout Stitch | [F-009-ui-stitch.md](./F-009-ui-stitch.md) |
| F-010 | Tipos de visualização do deck | [F-010-visualizacao-deck.md](./F-010-visualizacao-deck.md) |

## Como criar uma feature

1. Escolha o próximo ID livre (`F-007`, …).
2. Crie `docs/features/F-XXX-slug.md` com o template abaixo.
3. Atualize esta tabela.
4. No PR/commit/chat, cite `F-XXX` ou `US-XXX`.

## Template

```markdown
# F-XXX — Título

## Objetivo
Uma frase.

## Escopo
- …

## Fora de escopo
- …

## User stories
### US-XXX-01 — Título
**Como** … **quero** … **para** …

Critérios de aceite:
- [ ] …

## Regras
- …

## Superfície
- UI: …
- API: …
- Dados: …
```
