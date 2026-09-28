# F-009 — UI / layout Stitch

## Objetivo

Aplicar o design system e os layouts do projeto Stitch à aplicação Next.js existente, alinhando a aparência das telas principais sem alterar regras de negócio, APIs ou rotas.

## Escopo

- Extrair tokens visuais (cores, tipografia, espaçamento, raios) do projeto Stitch e integrá-los ao tema da app (`globals.css` / shell).
- Mapear telas Stitch → rotas existentes (`/`, `/buscar`, `/decks`, `/decks/[id]`, `/colecao`, `/colecao/[id]`, `/entrar`, `/cadastro`).
- Restylar shell de navegação, chrome de páginas e listas/cards para o visual Stitch.
- Manter comportamento funcional: auth, decks, canvas, coleção, busca, OCR, agrupamentos.

## Fora de escopo

- Scaffold de app Vite separado.
- Redesign funcional do canvas de deck (apenas chrome/painéis se houver design).
- Mudança de contratos de API ou schema de dados.
- Commit automático / deploy.

## User stories

### US-009-01 — Design system Stitch no tema da app

**Como** mantenedor **quero** tokens do Stitch no tema Next.js **para** tipografia, cores e espaçamento ficarem consistentes com o design.

Critérios de aceite:

- [x] Tokens extraídos dos HTML Stitch (cores, fontes, radius, spacing).
- [x] Tokens aplicados em `src/app/globals.css` (ou equivalente) e usados pelo shell/páginas.
- [x] Metadados do sync em `.stitch/metadata.json` com `Last Sync Time`.

### US-009-02 — Mapeamento tela Stitch → rota

**Como** desenvolvedor **quero** cada tela Stitch associada a uma rota da app **para** aplicar o layout no lugar certo sem inventar rotas.

Critérios de aceite:

- [x] Inventário de screens do projeto Stitch documentado (id, label, rota alvo).
- [x] HTML/PNG baixados em `.stitch/designs/` e auditados visualmente.
- [x] Telas sem rota clara marcadas como mismatch / adiadas.

### US-009-03 — Shell e páginas-chave alinhadas ao Stitch

**Como** jogador **quero** a UI principal com o visual Stitch **para** a app parecer o produto desenhado.

Critérios de aceite:

- [x] `app-shell` / navegação restylados.
- [x] Páginas chave restyladas: home, buscar, decks (lista), deck detail (modo lista), coleção, entrar/cadastro.
- [x] Funcionalidade existente preservada (sem regressão óbvia de fluxos).
- [x] Build/typecheck razoável após as mudanças.

## Regras

- Referenciar `F-009` / `US-009-xx` em resumos de trabalho de UI Stitch.
- Não sobrescrever `.stitch/designs/*` existentes sem confirmação do usuário.
- Preferir atualizar chrome/tema primeiro; depois páginas; canvas só no entorno.
- Não inventar estrutura Vite; mapear para App Router.

## Superfície

- UI: `src/app/globals.css`, `src/components/app-shell.tsx`, páginas sob `src/app/`.
- Design: `.stitch/designs/`, `.stitch/metadata.json`, `.stitch/style-guide.json`.
- API: nenhuma mudança prevista.
- Dados: nenhum schema novo.

## Mapeamento Stitch → rotas (US-009-02)

| Screen | Label | Rota |
|---|---|---|
| `cbcda840…` | Busca - MTG Helper | `/buscar` |
| `c8110659…` | Decks - Gerenciamento | `/decks` |
| `95364351…` | Detalhes do Deck | `/decks/[id]` (lista) |
| `60ddb133…` | Canvas - Edição de Deck | `/decks/[id]` (canvas) |
| `114ba251…` | Coleção - Gerenciamento | `/colecao` |
| `119692…` (×4) | image.png (refs) | sem rota — referências de UI anterior / canvas real |

Sem designs dedicados: `/`, `/entrar`, `/cadastro`, `/colecao/[id]` — recebem o design system via shell/tokens.
Nav Stitch “Formatos” / “Estatísticas” não existem como rotas; omitidos no shell.
