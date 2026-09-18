# F-001 — Motor de busca individual

## Objetivo

Permitir localizar uma carta por nome (PT-BR ou EN) em qualquer ponto do site, com autocomplete bilingue e preview da imagem.

## Escopo

- Campo reutilizável de busca (`CardSearch`).
- Autocomplete a partir de **4 caracteres**.
- Sugestões com nome em português (quando existir) e inglês.
- Preview da imagem em tamanho original ao pairar o mouse por **1 segundo**.
- Resolução: catálogo local primeiro; Scryfall se não houver match suficiente.

## Fora de escopo

- Filtros avançados (cor, CMC, formato) no autocomplete.
- Correção ortográfica agressiva além do fuzzy da Scryfall na resolução pontual.

## User stories

### US-001-01 — Autocomplete bilingue

**Como** jogador **quero** digitar parte do nome em PT ou EN **para** ver sugestões com os dois nomes.

Critérios de aceite:

- [ ] Com menos de 4 caracteres, não dispara busca.
- [ ] Com 4+ caracteres, lista sugestões (local e/ou Scryfall).
- [ ] Cada item mostra PT (se houver) e EN.
- [ ] Escape fecha a lista.

### US-001-02 — Seleção de carta

**Como** jogador **quero** clicar numa sugestão **para** usá-la no contexto (busca, deck, coleção).

Critérios de aceite:

- [ ] `onSelect` recebe `catalogId`, nomes, set e URIs de imagem.
- [ ] Carta escolhida é persistida/atualizada no catálogo local (F-006).

### US-001-03 — Preview com delay

**Como** jogador **quero** ver a carta grande ao pairar **para** confirmar sem abrir outra página.

Critérios de aceite:

- [ ] Delay de 1s antes do preview.
- [ ] Sair do item cancela o preview pendente.
- [ ] Preview usa `image_normal` (ou equivalente derivado de `small`).

## Regras

- Debounce na digitação (~250 ms).
- Respeitar rate limit da Scryfall (via F-006 / cliente compartilhado).
- Não sobrescrever User-Agent no browser; chamadas Scryfall só no servidor.

## Superfície

- UI: `src/components/card-search.tsx`, página `/buscar`
- API: `GET /api/cards/suggest?q=`
- Lib: `src/lib/cards.ts` (`suggestCards`)
