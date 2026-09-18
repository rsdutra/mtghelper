# F-002 — Motor de busca por lista

## Objetivo

Importar várias cartas de uma vez a partir de texto ou arquivo (`txt`/`csv`) no formato `quantidade nome`, reutilizando a mesma resolução de F-001/F-006.

## Escopo

- Parser de lista: `X Nome da carta` (também `Xx Nome`, CSV `qtde;nome`).
- Entrada por textarea ou upload de arquivo.
- Resolução linha a linha: catálogo local → Scryfall.
- Relatório de linhas não encontradas.
- Reuso do resolvedor único (sem duplicar lógica de F-001).

## Fora de escopo

- Detecção automática de sideboard MTGO/Arena além do formato simples.
- Importação de links de decklist externos (Moxfield, Archidekt).

## User stories

### US-002-01 — Importar texto

**Como** jogador **quero** colar uma lista **para** resolver todas as cartas de uma vez.

Critérios de aceite:

- [ ] Aceita linhas `1 Lightning Bolt` e `4 Violência Gratuita`.
- [ ] Ignora linhas vazias e comentários `#` / `//`.
- [ ] Retorna `resolved` e `missing`.

### US-002-02 — Importar arquivo

**Como** jogador **quero** enviar `.txt` ou `.csv` **para** não copiar manualmente.

Critérios de aceite:

- [ ] Upload preenche/processa o mesmo parser.
- [ ] Formato CSV com quantidade na primeira coluna funciona.

### US-002-03 — Rate limit em lote

**Como** sistema **quero** enfileirar lookups remotos **para** não tomar 429 da Scryfall.

Critérios de aceite:

- [ ] Lookups Scryfall passam pela fila (~600 ms entre search/named/collection).
- [ ] Cartas já no catálogo não geram chamada remota desnecessária.

### US-002-04 — Feedback visual durante importação

**Como** jogador **quero** ver um loading bloqueante ao importar lista **para** saber que o processo ainda roda e não clicar de novo.

Critérios de aceite:

- [x] Modal de loading ao importar lista (textarea/arquivo) em busca, deck e coleção.
- [x] Enquanto aberto, a tela não recebe interação (overlay + scroll travado).
- [x] Modal some ao terminar (sucesso ou erro parcial / missing).

## Regras

- Mesmo código de resolução que F-001 (`resolveCardName` / `parseCardList`).
- Quantidade mínima 1; linhas sem quantidade explícita podem defaultar para 1.

## Superfície

- UI: `src/components/list-import.tsx`, `/buscar`, formulários de deck/coleção
- API: `POST /api/cards/resolve`
- Lib: `src/lib/lists.ts`, `src/lib/cards.ts`
