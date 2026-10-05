# F-010 — Tipos de visualização do deck

## Objetivo

Oferecer, no modo Lista de `/decks/[id]`, três formas de ver as cartas — **Texto**, **Grid visual** e **Grid visual agrupada** — escolhidas num dropdown (referência: Moxfield), respeitando o agrupamento por tipo ou por custo.

## Escopo

- Dropdown “Visualização” no modo Lista com: Texto · Grid visual · Grid visual agrupada — US-010-01.
- View **Texto**: a lista atual sem miniatura; a carta só aparece ao pairar o mouse no texto — US-010-02.
- View **Grid visual**: só imagens, com quantidade sobreposta, linhas sobrepostas pela metade e ações de edição na vertical ao lado da carta — US-010-03.
- View **Grid visual agrupada**: pilhas em que cada carta cobre a anterior deixando só a faixa do título visível — US-010-04.
- Preview ampliado ao pairar **igual em todas as views**, com um único componente/hook reaproveitado (sem duplicar lógica) — US-010-05.
- Todas as views respeitam “Agrupar por tipo”, “Agrupar por custo” (F-004 / US-004-07, US-004-11) e “Agrupar por tag” (F-013 / US-013-05), inclusive grupos recolhíveis. No agrupamento por tag, o cabeçalho mostra a bolinha da cor.

## Fora de escopo

- Novos critérios de agrupamento/ordenação (ex.: por cor, raridade) ou “Sort” como no Moxfield.
- Mudanças no modo Canvas (F-008), além de passar a usar o mesmo preview (US-010-05).
- Mudanças em API/banco: é só apresentação; as ações usam as rotas existentes de `/api/decks/[id]/cards`.

## User stories

### US-010-01 — Seletor de visualização

**Como** jogador **quero** escolher como a lista do deck é exibida **para** alternar entre leitura rápida e conferência visual.

Critérios de aceite:

- [x] Dropdown “Visualização” no modo Lista, com Texto · Grid visual · Grid visual agrupada.
- [x] A escolha persiste em `localStorage` (`mtghelper.deck.listView`), como os toggles de agrupamento.
- [x] Default: Texto.
- [x] Toggle `Lista | Canvas` continua existindo; o dropdown só aparece no modo Lista.

### US-010-02 — View Texto

**Como** jogador **quero** uma lista só com texto **para** ler o deck de forma compacta.

Critérios de aceite:

- [x] Mesma linha da lista atual (quantidade, nome PT/EN, meta, ações), **sem miniatura**.
- [x] Pairar sobre o texto da carta mostra o preview ampliado (US-010-05).
- [x] Grupos por tipo/custo continuam recolhíveis.

### US-010-03 — View Grid visual

**Como** jogador **quero** ver o deck como grade de imagens **para** reconhecer as cartas pela arte.

Critérios de aceite:

- [x] Grade só com imagens (`image_normal`, fallback `image_small`), com selo de quantidade (`x4`) sobre a carta.
- [x] Cada linha da grade sobe sobre a anterior pela metade da altura da carta, para reduzir o tamanho da lista.
- [x] Ações de edição em coluna vertical ao lado da carta (ver decisões); a carta pairada/focada vem para frente e mostra a coluna inteira.
- [x] Pairar sobre a carta mostra o preview ampliado (US-010-05).
- [x] Cartas fora do deck (seção “Em trabalho”) seguem a mesma view.

### US-010-04 — View Grid visual agrupada

**Como** jogador **quero** ver cada grupo como uma pilha de cartas **para** comparar grupos lado a lado ocupando pouco espaço.

Critérios de aceite:

- [x] Cada grupo vira uma pilha (coluna) com cabeçalho recolhível; cada carta cobre a anterior deixando visível só a faixa do título (30 px).
- [x] A última carta da pilha aparece inteira.
- [x] Selo de quantidade na faixa visível de cada carta.
- [x] Mesmas ações de edição da Grid visual, exibidas ao lado da carta pairada (sem cobrir as faixas das outras).
- [x] Os três pontos do menu ficam na linha da quantidade, do lado direito da carta, e só aparecem na carta pairada (ou com o menu aberto; com foco pelo teclado também). Assim as cartas de trás da pilha também abrem o menu.
- [x] Pairar sobre a faixa ou a carta mostra o preview ampliado (US-010-05).

### US-010-05 — Preview ampliado compartilhado

**Como** jogador **quero** o mesmo preview grande em qualquer view **para** ter um comportamento previsível.

Critérios de aceite:

- [x] Um único hook de preview (`useCardHoverPreview`, `src/components/card-hover-preview.tsx`) usado pelas três views e pelo canvas (F-008).
- [x] O preview segue a altura do cursor, fica ao lado do cursor (Texto) ou ao lado da carta + ações (Grids) para não cobrir os botões, dentro da tela, e some ao sair da carta.

## Decisões (confirmadas com o usuário)

1. As views valem para “No deck” **e** “Em trabalho”.
2. Coluna vertical das Grids tem todas as ações: −/+, remover, detalhes, checkbox “No deck” e tags (seções).
3. Preview ao pairar aparece após ~300 ms, igual em todas as views (antes 1 s na lista).
4. Grid visual agrupada sem agrupamento por tipo/custo: pilhas de até 12 cartas lado a lado.
5. Branch da feature parte de `canvas-remodel` (canvas Konva ainda não integrado à `main`).

## Regras

- “Agrupar por título” no pedido original = “Agrupar por tipo” (US-004-07).
- Nenhuma view altera dados sozinha; ações chamam as mesmas funções da lista atual.
- Componentes de card (linha de texto, tile de grid, faixa de pilha) compartilham handlers e o preview.

## Superfície

- UI: modo Lista de `/decks/[id]` e `/decks/[id]/edit` (na visualização, Texto vira colunas condensadas e as ações somem — F-011). Na edição, a view Texto segue F-017: colunas por nome, preview fixo ao lado e sem preview ao pairar. Componentes em `src/components/deck-views/` (`DeckCardView`, `DeckCardActions`), preview em `src/components/card-hover-preview.tsx`
- Teste: `tests/f010-deck-views.spec.ts`
- API: nenhuma nova.
- Dados: nenhum novo (preferência em `localStorage`).

## Relação com outras features

- F-004: dona das cartas, `included`, seções/tags e dos toggles de agrupamento.
- F-008: modo Canvas, fora deste escopo.
