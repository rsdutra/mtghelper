# F-011 — Deck: modo visualização e modo edição

## Objetivo

Dividir o detalhe do deck em duas rotas — **visualização** (`/decks/[id]`) e **edição** (rota própria) — com o layout da tela “Detalhes do Deck” do Stitch, mais larga e responsiva, e uma visualização condensada em colunas (referência: Moxfield) para ver o deck inteiro sem rolar a página.

## Escopo

- Layout Stitch “Detalhes do Deck - Olivia V3” (`9536435150df48ee8c5b41929b69761f`) aplicado ao que já existe: largura maior (até 1720 px), subheader, barra de agrupamento/total, lista + painel lateral — US-011-01.
- Rota de **visualização** `/decks/[id]`: nome e formato como texto, sem ações nas linhas, sem painel de busca/ferramentas, botão **Editar** — US-011-02.
- View **Texto** condensada em colunas na visualização (grupos fluindo lado a lado, uma linha por carta) — US-011-03.
- Rota de **edição**: a tela atual (nome/formato editáveis, ações nas linhas, painel de busca, tags, lista, scanner, coleção) com o layout Stitch — US-011-04.
- Um componente base compartilhado pelas duas rotas; a edição adiciona componentes extras separados — US-011-05.

## Fora de escopo

- Remover funcionalidades existentes: tudo que hoje está na tela continua acessível (na visualização ou na edição).
- Itens do Stitch sem funcionalidade na app (nav “Formatos”/“Estatísticas”, “Salvo hoje, 09:42”, selo flutuante “SYNCHRONIZED”).
- Mudanças em API/banco.

## User stories

### US-011-01 — Layout Stitch mais largo e responsivo

**Como** jogador **quero** a tela do deck aproveitando telas grandes **para** ver mais cartas de uma vez.

Critérios de aceite:

- [x] Container das telas de deck até 1720 px (Stitch), com padding responsivo; shell (header/footer) alinhado.
- [x] Subheader com título/controles à esquerda e toggle de modo à direita, separado por borda.
- [x] Barra com agrupamento (tipo/custo) e seletor de visualização.
- [x] Lista em painel com barra de título “No deck (N)”.
- [x] Mobile: colunas colapsam para uma coluna, sem overflow horizontal.

### US-011-02 — Rota de visualização

**Como** jogador **quero** abrir o deck só para ler **para** não alterar nada sem querer.

Critérios de aceite:

- [x] `/decks/[id]` mostra nome e formato como texto (não editáveis).
- [x] Linhas sem −/+, remover, detalhes, “No deck”, tags ou cobertura.
- [x] Sem painel de busca/lista/seções/tags/coleção à direita.
- [x] Botão **Editar** leva à rota de edição.
- [x] Mantém: exportar (painel à direita, F-016), cobertura da coleção, gráficos, agrupamento, seletor de visualização (F-010), preview ao pairar.

### US-011-03 — Texto condensado em colunas

**Como** jogador **quero** ver a lista inteira numa tela **para** não precisar rolar.

Critérios de aceite:

- [x] Na visualização, a view Texto distribui os grupos em colunas (quantas couberem na largura), como o Moxfield.
- [x] Cada carta ocupa uma linha compacta (quantidade + nome; ver decisões).
- [x] Cabeçalho de grupo com nome e quantidade, recolhível.
- [x] Preview ao pairar no nome (F-010 / US-010-05).

### US-011-04 — Rota de edição

**Como** jogador **quero** uma tela de edição **para** montar o deck com todas as ferramentas.

Critérios de aceite:

- [x] Nome e formato editáveis + Salvar, como hoje.
- [x] Linhas com todas as ações atuais. Na view Texto da edição, essas ações ficam no ícone de opções (F-017). Grid e grid agrupada continuam no menu da carta.
- [x] Painel lateral (Stitch 4/12) com busca (botão Adicionar, US-004-18), lista, seção, tags, em trabalho + tag, coleção. O escanear saiu da edição do deck (US-004-18).
- [x] Botão para voltar à visualização.
- [x] Canvas (F-008) editável como hoje; na visualização, canvas somente leitura.
- [x] Os botões da coluna à direita (Busca, Gráficos, Tags, Ferramentas, Exportar; na visualização, Tags, Ferramentas e Exportar) funcionam como toggle exclusivo: abrir um painel fecha o que estava aberto, e clicar de novo no botão ativo fecha o painel. Só um painel fica visível por vez, sempre na mesma posição ao lado da coluna. Testes: `tests/f009-modal-camada.spec.ts`, `tests/f015-mana-colors.spec.ts`.

### US-011-05 — Componente compartilhado

**Como** mantenedor **quero** uma base única **para** não duplicar a tela.

Critérios de aceite:

- [x] Um componente base (carregamento, cabeçalho, lista, agrupamento, gráficos) usado pelas duas rotas com `mode: "view" | "edit"`.
- [x] Componentes exclusivos da edição (painel de ferramentas, ações de linha, campos editáveis) ficam em arquivos próprios.

## Decisões (confirmadas com o usuário)

1. Feature nova F-011.
2. URL da edição: `/decks/[id]/edit`.
3. Canvas nas duas telas; na visualização é **somente leitura** (pan, zoom, preview e copiar; sem arrastar, redimensionar, deletar, editar preço/nota nem salvar layout).
4. Linha do Texto condensado: só quantidade + nome (Moxfield); o resto fica no preview.
5. Na visualização, gráficos ficam num painel lateral à direita (onde estava a busca); a lista em colunas fica à esquerda.
6. Não incluir números extras do Stitch (CMC médio, preço estimado); só aplicar o layout. O total por seção continua no título “No deck (N)” / “Em trabalho (N)”.
7. Largura de até 1720 px só nas telas de deck.

## Regras

- A visualização não dispara escrita: agrupar por tipo/custo só reorganiza a lista no cliente; a sincronização das seções automáticas (US-004-07/11) continua na edição.
- Preferências (agrupamento, view F-010) são as mesmas nas duas rotas (`localStorage`).
- Criar um deck em `/decks` abre direto a edição (`/decks/[id]/edit`), já que o deck nasce vazio.
- Header do shell no mobile: botões “Importar Lista”/“+ Novo Deck” e o login só a partir de `sm`, para não gerar overflow horizontal (US-011-01).

## Testes

- `tests/f011-deck-view-edit.spec.ts`: visualização sem ações/ferramentas, linhas “qtd nome”, grupos lado a lado e recolhíveis, nenhuma escrita na visualização, sem overflow a 390 px, canvas somente leitura, ida/volta entre as rotas.
- Specs F-007/F-008/F-010/v1 usam a rota de edição para adicionar e editar cartas.

## Superfície

- UI: `src/app/decks/[id]/page.tsx` (visualização) e `src/app/decks/[id]/edit/page.tsx` (edição), ambas renderizando `DeckDetail` (`src/components/deck-detail/deck-detail.tsx`, `mode: "view" | "edit"`).
- Exclusivos da edição: `deck-edit-header.tsx`, `deck-edit-tools.tsx`, `use-deck-card-mutations.ts` (em `src/components/deck-detail/`) e `DeckCardActions`.
- Layout: `src/components/app-shell.tsx` (`wide`), `src/components/deck-views/deck-card-view.tsx` (`readOnly` → colunas condensadas), `src/components/deck-canvas-board.tsx` (`readOnly`).
- Design: Stitch `9536435150df48ee8c5b41929b69761f`.
- API/Dados: nenhum.

## Relação com outras features

- F-004: cartas, seções/tags, agrupamentos, coleção.
- F-008: canvas.
- F-009: design system Stitch (tokens).
- F-010: seletor de visualização e preview compartilhado.
- F-017: view Texto da edição (colunas, preview ao lado, menu de opções, custo de mana).
