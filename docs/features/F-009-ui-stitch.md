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

### US-009-04 — Modal sempre por cima

**Como** jogador **quero** que qualquer modal aberta fique na frente de tudo na tela **para** não ter painéis (busca, gráficos, tags, ferramentas) cobrindo a modal.

Critérios de aceite:

- [x] Componente compartilhado `Modal` (`src/components/modal.tsx`) usado por todas as modais do site.
- [x] A modal é renderizada no `<body>` (portal), fora de qualquer painel `fixed`/`z-*` que a prenderia atrás de outros painéis.
- [x] Todas as modais usam a mesma camada (`z-[1000]`), acima de painéis, menus e preview de carta.
- [x] Independe da ordem de abertura: a modal aberta por último fica por cima, inclusive o carregamento sobre a modal de lista.
- [x] “Adicionar lista” fica por cima do painel aberto e da coluna de botões. Antes vários painéis podiam ficar abertos juntos; desde F-011 / US-011-04 só um fica aberto por vez.

Causa do bug: a modal “Adicionar lista” era filha do painel de Busca (`fixed z-40`), que cria um contexto de empilhamento; o `z-[160]` dela só valia dentro do painel, e os painéis `z-40` vindos depois no HTML a cobriam.

### US-009-05 — Background em tom médio (menos branco, sem dark mode)

**Como** jogador **quero** um fundo de página um pouco mais escuro **para** a tela cansar menos e os painéis brancos se destacarem, sem virar dark mode.

Critérios de aceite:

- [x] Proposta gerada no Stitch (variantes de esquema de cor sobre a tela “Decks - Gerenciamento”), mantendo layout, tipografia, bordas e componentes.
- [x] Variante escolhida pelo usuário e salva em `.stitch/designs/` (sem sobrescrever os designs existentes). Salvas: `decks-bg-zinc-neutro`, `decks-bg-slate-frio`, `decks-bg-stone-quente` (`.html` + `.png`); segunda rodada em `decks-bg2-*`; escolhida: V2 Faixa carvão.
- [x] Token `--color-background` (e afins do canvas) atualizado em `src/app/globals.css`; cards, painéis e inputs continuam brancos.
- [x] Texto continua escuro sobre fundo claro (contraste AA); não é dark mode. `--color-muted` foi de `#71717a` para `#47464a` para manter AA sobre o cinza.
- [x] Typecheck, lint, build e verificação visual. Typecheck e build ok; visual ok em `/entrar` e `/buscar`. Os erros de lint (`react-hooks`) já existiam e não são das linhas alteradas.

Prompt enviado ao Stitch (`generate_variants`, `creativeRange: REFINE`, `aspects: [COLOR_SCHEME]`):

> Darken the overall page canvas background slightly while keeping the exact same layout, content, typography, 1px borders, 2px radius and monochrome studio style. This is NOT a dark mode: text stays dark on light surfaces. Change the page background from near-white (#f9f9fa) to a soft mid-light neutral gray (in the range #e4e4e7 to #d4d4d8) so the white cards, panels, tables and inputs (#ffffff) read as raised surfaces with clear contrast. The top navigation bar may use a tone between the canvas and white. Keep black primary buttons and dark text unchanged. Optionally add a very faint fine dot-grid texture to the canvas only.

Variantes geradas pelo Stitch (screens no projeto `15205195196080306830`):

| Variante | Screen | Fundo |
|---|---|---|
| Zinc Neutro (rejeitada) | `8a90c71615ca41e99a8d7dfe97a2631b` | `#e4e4e7` + dot grid `#a1a1aa` 16 px |
| Slate Frio (rejeitada) | `913dfb13c200418fa5346cda3193d1fe` | `#dbe0e6` + dot grid `#94a3b8` 16 px; header/footer `#f1f5f9`; bordas `#cbd5e1` |
| Stone Quente (rejeitada) | `c5c979d3928a491a95f14057aa81298b` | `#e5e3df` + dot grid `#a8a29e` 16 px; header/footer `#f5f5f4`; bordas `#d6d3d1` |

Segunda rodada (Stone Quente também não agradou). Prompt pediu 5 direções distintas, sem dot grid e sem cinza claro liso (`generate_variants`, `creativeRange: EXPLORE`, `aspects: [COLOR_SCHEME]`). Arquivos `decks-bg2-*` em `.stitch/designs/`:

| Variante | Screen | Tratamento |
|---|---|---|
| V1 Cinza médio + sombra suave (rejeitada) | `197e1ac771824e149a2e77e8f435f1eb` | canvas liso ~`#c4c4c8`, painéis com sombra suave |
| V2 Faixa carvão (aplicada) | `343729458fa943f59bb166578e55f8d1` | faixa `#27272a` atrás do nav e do título (texto branco), canvas cinza médio abaixo |
| V3 Gradiente + vinheta | `add77a6377c54282978843c3820d18a3` | gradiente vertical de cinza claro a ~`#a8a8ac`, vinheta nas bordas |
| V4 Azul-acinzentado | `8f61f60335514aaa89be4b4f93ad37af` | canvas liso ~`#b8c0c8` |
| V5 Papel + sombra dura | `be7105e436e645e29aa5370a3ba2f679` | cinza quente com grão de papel, bordas pretas e sombra deslocada de 3 px |

Comparação lado a lado: `/buscar` com V2, `/decks` com V3, `/colecao` com V4 e o restante com V1. O usuário escolheu a **V2 Faixa carvão** como padrão de todas as telas, e o mapeamento por rota foi removido.

Decisão final — **V2 Faixa carvão**:

- Header escuro em todas as telas: `bg-band` (`#27272a`), borda `band-line` (`#3f3f46`), classe `.ui-on-dark` (texto branco, `muted` `#a1a1aa`, botões invertidos).
- Título da página na mesma faixa, em largura total: bloco marcado com `data-page-hero` em `/buscar`, `/decks`, `/colecao` e `/colecao/[id]`.
- Detalhe do deck (`/decks/[id]`): só o header fica escuro; o subheader (nome editável, badges, alternador de visualização) continua sobre o fundo claro, porque os controles dependem de `ink` escuro.
- Login, cadastro e início não têm bloco de título fora do painel; só o header fica escuro.
- Fundo do conteúdo `#d4d4d8`; footer `#c8c8cc`.
- Painéis continuam brancos com `shadow-panel` (herdado da V1, presente na tela aprovada).

Aplicada antes da comparação: V1 Cinza médio + sombra suave.

- Fundo `#c4c4c8` liso, sem textura.
- Header e footer brancos (`--color-nav: #ffffff`) com `shadow-sm`.
- Painéis principais das páginas com o utilitário `shadow-panel` (`0 8px 24px rgb(0 0 0 / 0.12)`). Modais e menus mantêm a sombra dura própria.
- Bordas `outline-variant` voltam ao original `#c8c5ca`.
- `--color-muted` em `#47464a`, para manter AA sobre o cinza médio.

Decisões da primeira rodada (usuário pediu para aplicar o que o Stitch propôs; aplicadas como na variante Zinc Neutro, sujeitas à validação visual):

1. Variante: testadas Zinc Neutro e Slate Frio; o usuário escolheu a **Stone Quente**.
2. Textura: dot grid sutil no fundo da página (só no canvas, não nos painéis).
3. Header/footer: token `--color-nav` (`#f5f5f4`, header a 95% com `backdrop-blur`), borda `outline-variant` (`#d6d3d1`).
4. Texto secundário (`--color-muted`): `#57534e`, para manter AA sobre o fundo.

## Regras

- Toda modal nova usa `Modal` de `src/components/modal.tsx`; não criar fundo `fixed inset-0 z-*` próprio.
- Referenciar `F-009` / `US-009-xx` em resumos de trabalho de UI Stitch.
- Não sobrescrever `.stitch/designs/*` existentes sem confirmação do usuário.
- Preferir atualizar chrome/tema primeiro; depois páginas; canvas só no entorno.
- Não inventar estrutura Vite; mapear para App Router.

## Superfície

- UI: `src/app/globals.css`, `src/components/app-shell.tsx`, páginas sob `src/app/`, `src/components/modal.tsx` (US-009-04).
- Testes: `tests/f009-modal-camada.spec.ts` (US-009-04).
- Design: `.stitch/designs/`, `.stitch/metadata.json`, `.stitch/style-guide.json`.
- API: nenhuma mudança prevista.
- Dados: nenhum schema novo.

## Mapeamento Stitch → rotas (US-009-02)

| Screen | Label | Rota |
|---|---|---|
| `cbcda840…` | Busca - MTG Helper | `/buscar` |
| `c8110659…` | Decks - Gerenciamento | `/decks` |
| `95364351…` | Detalhes do Deck | `/decks/[id]` e `/decks/[id]/edit` (lista — F-011) |
| `60ddb133…` | Canvas - Edição de Deck | `/decks/[id]/edit?view=canvas` (somente leitura em `/decks/[id]?view=canvas`) |
| `114ba251…` | Coleção - Gerenciamento | `/colecao` |
| `119692…` (×4) | image.png (refs) | sem rota — referências de UI anterior / canvas real |

Sem designs dedicados: `/`, `/entrar`, `/cadastro`, `/colecao/[id]` — recebem o design system via shell/tokens.
Nav Stitch “Formatos” / “Estatísticas” não existem como rotas; omitidos no shell.
