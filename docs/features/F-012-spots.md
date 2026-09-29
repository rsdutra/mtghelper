# F-012 — Spots do deck

## Objetivo

O jogador cria spots nomeados, presos ao deck, e agrupa as cartas do deck por esses spots, no mesmo espírito do agrupamento por tipo.

## Escopo

- Spec apenas. A implementação fica para uma entrega seguinte.
- O spot é um agrupamento do deck, com nome escolhido pelo usuário.
- Na edição, o jogador **adiciona** uma carta que já está na lista do deck a um spot, ou **remove** a carta do spot. As duas ações não alteram `place`.
- Novo modo **Agrupar por spot**, exclusivo com agrupar por tipo e agrupar por custo. As cartas do deck (`place = main`) aparecem na seção do spot em que estão. Carta sem spot cai na seção **Sem spot**.
- Spots valem só para cartas no deck. Sideboard (`side`) e fora do deck (`out`) não têm spot.

## Fora de escopo

- Canvas. O agrupamento por tipo também reorganiza o canvas; esta spec cobre a lista do deck.
- Reordenar spots.
- Arrastar carta para a seção. Adicionar e remover são ações explícitas.
- Dividir a quantidade de uma linha entre spots.
- Colocar a mesma carta em mais de um spot.
- Reintroduzir `deck_sections`, seções automáticas por tipo/custo ou tags manuais de seção. As tags da F-013 continuam outra coisa: cor e nome na carta, não um agrupamento do deck.
- Mudar a contagem do deck ou do sideboard. A contagem segue `place`.

## User stories

### US-012-01 — Criar um spot

**Como** jogador **quero** criar um spot com o nome que eu escolher **para** separar grupos de cartas do deck.

Critérios de aceite:

- [ ] Na edição do deck, o usuário informa um nome e cria o spot.
- [ ] O spot fica preso àquele deck.
- [ ] O nome é obrigatório, sem espaços nas pontas, com no máximo 40 caracteres, único no deck ignorando maiúsculas. O nome **Sem spot** é reservado e não pode ser usado.
- [ ] O spot pode ser renomeado ou excluído. Renomear obedece as mesmas regras do nome.
- [ ] Excluir o spot não apaga cartas. As cartas que estavam nele ficam sem spot.
- [ ] No modo visualização o jogador vê os spots, mas não cria, renomeia nem exclui.

### US-012-02 — Adicionar carta ao spot e remover carta do spot

**Como** jogador **quero** adicionar ao spot uma carta que já está na lista do deck, ou removê-la do spot, **para** organizá-la sem mudar o lugar dela.

Critérios de aceite:

- [ ] As ações se chamam **Adicionar carta ao spot** e **Remover carta do spot**.
- [ ] Só uma carta que já existe com `place = main` pode ser adicionada. A ação não cria carta. Busca, lista e OCR continuam adicionando a carta ao deck como hoje, sem spot.
- [ ] Adicionar ou remover não muda `place`. A carta segue contando no deck.
- [ ] Uma carta tem no máximo um spot. Adicionar a outro spot substitui o anterior.
- [ ] A linha inteira entra no spot: todas as cópias daquela carta vão juntas. Mudar a quantidade não tira o spot, enquanto a linha existir.
- [ ] **Remover carta do spot** só aparece quando a carta tem spot. A carta continua no deck e passa a contar como sem spot.
- [ ] Carta em `side` ou `out` não oferece essas ações.
- [ ] Se `place` deixar de ser `main`, a carta perde o spot na hora e fica sem spot. A seção **Sem spot** não é desenhada no sideboard nem em fora do deck: ela só lista cartas `main` sem spot. Quando a carta voltar para `main`, ela aparece em **Sem spot**.
- [ ] Se a carta for removida do deck, a linha de `deck_cards` some e o registro do spot some com ela.
- [ ] No menu da carta, na edição, dá para adicionar a um spot existente ou remover do spot atual. O menu mostra o spot atual quando houver.

### US-012-03 — Agrupar por spot

**Como** jogador **quero** agrupar a lista do deck por spot **para** ver cada grupo junto, como no agrupamento por tipo.

Critérios de aceite:

- [ ] Controle **Agrupar por spot** na mesma barra de agrupamento da lista do deck, no modo visualização e na edição.
- [ ] Vale só para as cartas `place = main`. Sideboard e fora do deck continuam nas listas deles, sem seções de spot.
- [ ] Com o agrupamento ligado, cada spot do deck vira uma seção colapsável, com o nome do spot. A seção existe mesmo sem carta.
- [ ] Cartas `main` sem spot ficam na seção **Sem spot**. Essa seção não é um spot, não é gravada e não pode ser renomeada nem excluída. Some quando não há carta nela.
- [ ] A ordem é a de criação dos spots. **Sem spot** fica por último.
- [ ] O modo é exclusivo com agrupar por tipo e agrupar por custo: só um agrupamento fica ligado.
- [ ] Desligar o agrupamento volta a lista plana do deck, sem seções. Os spots e as associações continuam salvos.
- [ ] Texto, grid visual e grid visual agrupada respeitam essas seções, como já respeitam tipo e custo.
- [ ] A preferência do controle persiste em `localStorage`, como os outros agrupamentos.

## Regras

- Spot e `place` são paralelos. O spot organiza; `place` diz se a carta está no deck, no sideboard ou fora.
- Estar sem spot não é um registro. É a ausência de associação. A seção **Sem spot** só existe na lista do deck quando o agrupamento está ligado e há carta `main` sem spot.
- Spot não entra na contagem de 60/100 nem na de sideboard.
- Formatos sem sideboard não ganham um spot de sideboard. Sideboard continua sendo `place = side`.
- Há uma linha de `deck_cards` por carta do deck. O spot aponta para essa linha.

## Superfície

- UI: criar, renomear e excluir spot na edição; no menu da carta, **Adicionar carta ao spot** e **Remover carta do spot**; controle Agrupar por spot na barra de agrupamento.
- API nova, por deck. Não reutilizar `/sections`. Recusa adicionar carta cujo `place` não seja `main`. Ao mudar `place` para `side` ou `out`, apaga a associação na mesma operação. Ao apagar a carta, a associação cai junto.
- Dados: tabela de spots do deck (`deck_id`, nome, data de criação) e associação da carta com no máximo um spot. Não recriar `deck_sections` nem `deck_card_sections`. Apagar o deck, o spot ou a carta apaga o que dependia deles.

## Decisões confirmadas

1. A nomenclatura é **Adicionar carta ao spot** e **Remover carta do spot**. Só entra carta que já está na lista do deck (`place = main`).
2. Uma carta tem um spot só. Adicionar a outro substitui o atual.
3. Se `place` deixar de ser `main`, a associação é apagada e a carta fica sem spot. Se a carta for removida do deck, o registro dela e o do spot são apagados.
4. **Agrupar por spot** entra na barra, exclusivo com tipo e custo.
5. Spot vazio aparece no agrupamento. **Sem spot** só aparece se houver carta `main` sem spot, por último, na ordem de criação dos demais.
