# F-008 — Canvas de deck

## Objetivo

Canvas interativo (tldraw) para organizar visualmente as cartas do deck, com persistência de posições e evolução independente do CRUD de lista (F-004).

## Escopo

- Persistir snapshot do canvas por deck (posições, frames, câmera) — US-008-01.
- Autosave / salvar manual / salvar ao sair — US-008-01.
- **US-008-02:** ações de domínio no canvas gravam no Postgres do deck:
  - deletar carta (shape) → remove cópia/linha em `deck_cards`;
  - mover carta para frame de seção / para o board → atualiza tags em `deck_card_sections`.
- **US-008-03:** toggle “Agrupar por tipo” no canvas cria frames/seções por tipo; desligar remove só essas seções, mantendo as cartas.
- **US-008-07:** agrupar por custo (CMC); cartas com sessão `user` não são movidas.
- **US-008-04:** painel lateral colapsável + preview ampliado ao pairar na carta (com delay).
- **US-008-05:** botão direito na carta → copiar nome.
- **US-008-08:** Canvas v2 com Konva (MIT), em paralelo ao tldraw, com as mesmas funcionalidades e persistência própria.

## Fora de escopo (agora)

- Colaboração em tempo real.
- Histórico/versionamento de snapshots.
- Export PNG/PDF.
- Toggle `included` direto no canvas (lista/painel por enquanto).

## User stories

### US-008-01 — Persistência e autosave

(critérios já implementados)

### US-008-02 — Ações do canvas → banco

**Como** jogador **quero** que apagar ou mover carta no canvas atualize o deck **para** não depender só do snapshot visual.

Critérios de aceite:

- [x] Deletar shape de carta remove 1 cópia (ou a linha se qty=1) via API.
- [x] Mover para frame de seção aplica a tag da seção.
- [x] Tirar do frame (pai = página) remove tags de seção daquela carta.
- [x] Após mutação, marca canvas dirty e mantém sync com F-004.
- [x] Frames de seção continuam identificáveis por `meta.mtgKey = frame:{sectionId}`.

### US-008-03 — Sessões por tipo no canvas

**Como** jogador **quero** o mesmo “Agrupar por tipo” no canvas **para** ver o deck em frames por tipo (Criaturas, Terrenos…).

Critérios de aceite:

- [x] Toggle visível no header do canvas (mesma preferência da lista).
- [x] Ao habilitar: cria seções `kind=type` e frames correspondentes; cartas `included` recebem a tag do tipo (tags `user` preservadas).
- [x] Ao desabilitar: remove **apenas** seções/frames `kind=type`; cartas permanecem no workspace (e no canvas, reparentadas para o board se necessário).
- [x] Layout no canvas prioriza seção `type` quando a carta tem essa tag.
- [x] Cartas com tag `user` não recebem seção `type` automática.

### US-008-07 — Sessões por custo (CMC)

**Como** jogador **quero** agrupar o canvas por CMC **para** ver a curva em frames.

Critérios de aceite:

- [x] Toggle “Agrupar por custo” no header (exclusivo com tipo).
- [x] Cria seções `kind=cost` (CMC 0–6 / 7+) só para cartas sem tag `user`.
- [x] Desligar remove só `kind=cost`; cartas permanecem.
- [x] `primarySection` prioriza `type`/`cost` sobre tags user quando existirem.

### US-008-04 — Painel colapsável e preview de carta

**Como** jogador **quero** recolher o painel de busca e ampliar a carta sob o mouse **para** ver o canvas com mais espaço e conferir arte/texto.

Critérios de aceite:

- [x] Painel direito (busca/lista/tags) começa fechado ou pode ser fechado; botão flutuante à direita abre/fecha.
- [x] Ao manter o mouse ~1,5s sobre uma carta, preview maior aparece junto ao cursor.
- [x] Mover rápido entre cartas não dispara preview (delay reinicia); sair da carta esconde o preview.

### US-008-05 — Copiar nome no botão direito

**Como** jogador **quero** copiar o nome da carta com o botão direito no canvas **para** colar em busca/lista rapidamente.

Critérios de aceite:

- [x] Clique direito sobre uma carta abre menu com “Copiar nome”.
- [x] Copia `name_pt` se existir, senão `name_en`.
- [x] Feedback breve “Nome copiado” no menu; menu fecha ao clicar fora ou Esc.

### US-008-06 — Preço / nota no canvas

**Como** jogador **quero** editar preço e nota no canvas **para** não sair do layout visual.

Critérios de aceite:

- [x] Botão direito → “Preço / Nota…” abre o mesmo modal da lista.
- [x] Duplo clique na carta abre o modal.
- [x] Se houver preço, o menu oferece a opção Copiar preço.

### US-008-08 — Canvas v2 (Konva)

**Como** dono do app **quero** um segundo canvas feito com Konva **para** não depender da licença comercial do tldraw em produção, sem perder o canvas atual enquanto o v2 amadurece.

Critérios de aceite:

- [x] Seletor `Lista | Canvas | Canvas v2` na página do deck; os dois canvas ficam habilitados.
- [x] Snapshot separado por engine (`deck_canvas_konva`); layouts do tldraw não são migrados.
- [x] `GET|PUT /api/decks/[id]/canvas?engine=konva` lê/grava o snapshot do v2.
- [x] Cartas renderizadas por cópia (qty expandida), com opacidade e marcador laranja para `included=false`.
- [x] Frames por seção (`user`, `type`, `cost`) com nome, arrastáveis e redimensionáveis; cartas acompanham o frame.
- [x] Soltar carta num frame aplica a tag da seção; soltar no board remove as tags `user` (mesma API do v1).
- [x] Delete/Backspace remove 1 cópia por carta selecionada.
- [x] Seleção por clique, Shift+clique e Shift+arrastar (retângulo); arrastar a seleção move todas as cartas.
- [x] Pan arrastando o fundo ou com a roda; zoom com Ctrl/⌘+roda e botões (+, −, ajustar).
- [x] Sync de domínio preserva posições salvas; só itens novos ou que mudaram de seção recebem layout default.
- [x] Salvar manual, autosave (5 min) e salvar ao sair / trocar de modo, com status dirty/salvo/erro.
- [x] Preview ampliado após ~1,5 s sobre a carta, menu do botão direito (copiar nome/nome EN/preço, Preço / Nota…) e duplo clique abrindo o modal.
- Fora de escopo no v2: desfazer/refazer (as ações têm efeito no banco).

## Regras

- Snapshot é JSON do tldraw (`getSnapshot` / `loadSnapshot`), incluindo posição de cartas, tamanho/posição de frames e câmera.
- Após carregar o snapshot, o sync de domínio **não** reposiciona nem redimensiona shapes já existentes.
- Só o dono do deck lê/grava o canvas.
- Autosave não bloqueia a UI; falha mostra status sem perder o editor.
- `beforeunload` usa `keepalive`/`sendBeacon` ou fetch sync best-effort.

## Superfície

- UI: modo Canvas em `/decks/[id]`, `src/components/deck-canvas.tsx`; Canvas v2 em `src/components/deck-canvas-konva.tsx`
- API: `GET|PUT /api/decks/[id]/canvas` (`?engine=konva` para o v2)
- Dados: `deck_canvas(deck_id, snapshot, updated_at)`; v2 em `deck_canvas_konva(deck_id, snapshot, updated_at)`

## Relação com F-004

- F-004 mantém deck, cartas, seções e o toggle Lista/Canvas.
- F-008 é dona do comportamento e persistência do quadro.
