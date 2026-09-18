# F-007 — Escaneamento de cartas (OCR local)

## Objetivo

Permitir adicionar cartas ao deck ou à coleção a partir de webcam, câmera do dispositivo ou upload de imagem, lendo só o **título** com OCR local (Tesseract.js) e pedindo confirmação do usuário + escolha do set.

## Escopo (V1)

- Entrada: webcam/câmera do browser **ou** upload de imagem (`image/*`).
- Guia visual para enquadrar a faixa do título (topo da carta).
- Crop automático/manual da região do título (~15–25% superior da imagem alinhada).
- OCR **somente local** via **Tesseract.js** no browser (WASM). Sem API cloud de visão.
- Idiomas do worker: `eng+por` (inglês + português).
- Texto OCR → limpeza → candidatos via F-001 / F-006 (`suggest` / `resolve`).
- Usuário confirma a carta na lista (PT + EN + thumb).
- Usuário escolhe o **set**; se omitir, usa impressão mais recente (mesma regra de F-005).
- Destino configurável: deck atual, seção do deck, ou coleção.
- Fallback: se OCR falhar ou confiança baixa, abrir F-001 (busca manual) com o texto parcial pré-preenchido.
- Processar **um frame / uma foto por vez** (não OCR contínuo em vídeo na V1).

## Fora de escopo (V1)

- OCR cloud (Google Vision, etc.).
- Matching visual por arte / embeddings.
- Leitura de collector number, código de barras ou texto Oracle.
- Escaneamento em lote (várias cartas na mesa).
- App nativo mobile dedicado (usa o browser + `getUserMedia` / file picker).
- Treinar ou fine-tunar modelo Tesseract para molduras Magic.

## User stories

### US-007-01 — Capturar imagem

**Como** jogador **quero** abrir a webcam ou enviar uma foto **para** iniciar o escaneamento.

Critérios de aceite:

- [x] Botão “Usar câmera” solicita permissão e mostra preview.
- [x] Botão “Enviar imagem” aceita arquivo de imagem.
- [x] Posso capturar um frame estático da webcam (shutter), não stream OCR.

### US-007-02 — Ler só o título

**Como** jogador **quero** que o sistema leia a faixa do nome **para** achar a carta sem processar a arte inteira.

Critérios de aceite:

- [x] Overlay indica a zona do título.
- [x] OCR roda sobre a crop do título, não a carta inteira por padrão.
- [x] Progresso do Tesseract é visível (loading / %).
- [x] Worker usa `eng+por`.

### US-007-03 — Confirmar carta e set

**Como** jogador **quero** escolher entre candidatos e o set **para** não cadastrar a impressão errada.

Critérios de aceite:

- [x] Lista de candidatos com nomes PT/EN e thumb (F-001).
- [x] Select de set; vazio = impressão mais recente (F-005 / F-006).
- [x] Posso corrigir digitando na busca se a lista estiver errada.

### US-007-04 — Adicionar ao destino

**Como** jogador **quero** mandar a carta confirmada para deck, seção ou coleção **para** não repetir o fluxo manual.

Critérios de aceite:

- [x] No contexto de deck: adiciona ao deck ou à seção selecionada (F-004).
- [x] No contexto de coleção: adiciona à coleção atual (F-005).
- [x] Quantidade default 1 (editável antes de confirmar).

### US-007-05 — Degradar com elegância

**Como** jogador **quero** um caminho manual se o OCR falhar **para** não ficar bloqueado.

Critérios de aceite:

- [x] Mensagem clara quando não houver texto útil.
- [x] Texto parcial (se houver) pré-preenche F-001.
- [x] Nenhuma imagem é enviada a servidor de OCR de terceiros.

## Regras

- OCR 100% no cliente na V1. Imagem **não** sobe para backend só para leitura de texto.
- Depois da confirmação, a resolução de carta/set usa as APIs já existentes (F-001/F-002/F-006); aí sim o servidor fala com Scryfall/Postgres.
- Uma captura = uma tentativa de OCR; reprocessar exige novo shutter/crop.
- Não rodar OCR a cada frame do vídeo (economia de CPU e menos “pipoca” de resultado).
- Foil/reflexo: copy na UI pedindo luz difusa e ângulo sem brilho.
- Rate limit Scryfall continua valendo só na etapa de resolução pós-OCR.
- Feature depende de F-001, F-004, F-005 e F-006; não duplicar resolvedor.

## Fluxo

```text
[Câmera | Upload]
      → preview + zona do título
      → crop da faixa
      → Tesseract.js (eng+por) no browser
      → limpar texto (trim, quebras, símbolos de mana acidentais)
      → GET /api/cards/suggest?q=...  (se ≥ 4 chars) e/ou resolve
      → usuário escolhe carta + set + quantidade + destino
      → POST deck/coleção existente
```

## Superfície

- UI: `src/components/card-scanner.tsx` em `/decks/[id]` e `/colecao/[id]`
- Lib cliente: `src/lib/ocr/` (`clean`, `crop`, `worker`)
- API: reutiliza `/api/cards/suggest`, endpoints de deck/coleção (`set` opcional no deck)
- Dados: nenhum schema novo na V1 (usa `catalog_cards` + destino)

## Notas técnicas — Tesseract.js

Ver também a explicação no chat desta feature. Resumo para implementação:

- Pacote: `tesseract.js` (engine Tesseract via WebAssembly no browser).
- Criar **um** `worker` e reutilizar (criar a cada scan é lento: baixa `traineddata`).
- V6+: idiomas no `createWorker('eng+por')`; não usar `loadLanguage`/`initialize` legados.
- Passar para `recognize()` a crop (canvas/blob), não a foto cheia.
- Cache do `traineddata` no IndexedDB na primeira visita; cold start mais lento.
- Adequado a desktop/webcam; foil e baixa luz degradam acurácia — confirmação humana é obrigatória.

## Evolução (não V1)

- V2: collector number na base da carta; confiança do OCR; retake guiado.
- V3: cloud OCR opcional / matching por arte; lote na mesa.
