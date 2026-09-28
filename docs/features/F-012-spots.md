# F-012 — Criação de spot

## Objetivo

Permitir que o jogador crie spots de cartas para organizar o deck no lugar das antigas seções/tags.

## Escopo

- Spec apenas. A implementação fica para uma entrega seguinte.
- O spot é um agrupamento visual e de organização criado pelo usuário, com nome e posição, associado a cartas do deck.
- A carta continua em um dos lugares já existentes: fora do deck, no deck ou sideboard. O spot não substitui esses lugares.

## Fora de escopo

- Implementar UI, API ou tabelas nesta entrega.
- Reintroduzir `deck_sections`, tags manuais ou seções automáticas por tipo/custo.
- Mudar a regra de tamanho do deck ou do sideboard.

## User stories

### US-012-01 — Criar um spot

**Como** jogador **quero** criar um spot com nome **para** separar grupos de cartas dentro do deck.

Critérios de aceite:

- [ ] Na edição do deck, o usuário informa um nome e cria o spot.
- [ ] O spot aparece na lista e pode ser renomeado ou excluído.
- [ ] Excluir o spot não apaga as cartas.

### US-012-02 — Colocar cartas em um spot

**Como** jogador **quero** mover cartas para um spot **para** organizar o deck sem tirá-las do lugar em que estão.

Critérios de aceite:

- [ ] Uma carta pode entrar e sair de um spot sem mudar “fora do deck”, “no deck” ou “sideboard”.
- [ ] A mesma carta não precisa estar em mais de um spot.
- [ ] O canvas pode usar o spot como quadro, quando essa parte for implementada.

## Regras

- Spots são organização. A contagem do deck continua em `included` e `in_sideboard`.
- Formatos sem sideboard não ganham spot de sideboard; o sideboard segue a regra atual de formato.
- A função antiga de seção/tag foi removida de propósito e não volta com este nome.

## Superfície

- UI: a definir na implementação (criação, lista e ação de mover carta para o spot).
- API: a definir; não reutilizar `/sections`.
- Dados: tabela nova, separada de `deck_cards`. Não recriar `deck_sections` nem `deck_card_sections`.
