# Referência prática: Scryfall API

Guia interno do MTG Helper para busca de cartas, imagens e cache. Não é um espelho da documentação: só o que o app precisa para organizar coleção, conferir decks e montar canvas.

Base: `https://api.scryfall.com` — apenas HTTPS (TLS 1.2+). HTTP em claro não é atendido. Respostas em UTF-8.

Os endpoints de carta usados aqui são **públicos**. Não exigem `Authorization`. Autenticação (`Bearer`) existe para outros métodos da API; as páginas de cards, sets, rulings, catalogs e bulk data consultadas não pedem segredo.

---

## 1. O que a API oferece e o que NÃO oferece

### Oferece

- Dados de carta no mesmo conjunto do site: nome, custo de mana, tipo, texto Oracle, cores, identidade de cor, legalidade, raridade, set, número de colecionador, preços diários, URIs de imagem, faces, rulings e cartas relacionadas.
- Busca fulltext com a mesma sintaxe do site (`/cards/search`).
- Lookup por nome, Scryfall ID, set + collector number, Multiverse ID, Arena ID.
- Lote de até 75 identificadores (`POST /cards/collection`).
- Autocomplete de nomes em inglês (até 20 sugestões).
- Export diário comprimido de quase toda a base (`/bulk-data`) — útil depois para cache local; **não implementar agora**.

### Não oferece (ou não substitui)

- **Preço em tempo real.** Preços são atualizados **uma vez por dia**. Consultar a API com mais frequência não traz preço novo. Bulk data fica “perigosamente desatualizado” depois de 24 h. Não use para loja, checkout ou arbitragem.
- **Regras oficiais do jogo.** `oracle_text` e `legalities` são dados de referência. Rulings vêm da Wizards (`source: wotc`) ou notas da Scryfall (`source: scryfall`). Não substitui o Comprehensive Rules nem o Judge Center.
- **Correção ortográfica na busca.** `/cards/search` não corrige erro de digitação e não refaz a query com `include:extras` / `lang:any` como o site faz. Para nomes, use autocomplete ou `/cards/named?fuzzy=`.
- **Deck building, coleção do usuário, preços de marketplace ao vivo.** `purchase_uris` só aponta para lojas parceiras.
- **Imagens “nossas”.** As scans são material de Magic / Fan Content Policy da Wizards, servidas pela Scryfall. Há regras de uso (seção 2 e 5).
- **API key para os métodos públicos de carta.** Identifique o app no `User-Agent`, não com token.

`legalities` possíveis: `legal`, `not_legal`, `restricted`, `banned`. Chaves observadas em cartas reais incluem `standard`, `future`, `historic`, `timeless`, `gladiator`, `pioneer`, `modern`, `legacy`, `pauper`, `vintage`, `penny`, `commander`, `oathbreaker`, `standardbrawl`, `brawl`, `competitivebrawl`, `alchemy`, `paupercommander`, `duel`, `oldschool`, `premodern`, `predh`, `tlr`. A lista de formatos na sintaxe de busca (`f:`) é a referência; trate chaves desconhecidas como dados novos, não como erro.

---

## 2. Convenções obrigatórias

### Headers em toda request para `api.scryfall.com`

| Header | Regra |
|---|---|
| `User-Agent` | Obrigatório e **específico do app**. Ex.: `MTGHelper/0.1`. Não deixe a biblioteca HTTP inventar o valor. Se a chamada for JavaScript no browser, **não** sobrescreva o User-Agent do navegador. |
| `Accept` | Obrigatório, mas pode ser genérico: `*/*` ou `application/json;q=0.9,*/*;q=0.8`. |
| `Content-Type` | `application/json` no `POST /cards/collection`. |

### Rate limit (limites duros)

Só `api.scryfall.com` conta. Arquivos em `*.scryfall.io` (imagens em `cards.scryfall.io`) **não** têm esse limite.

| Método | Limite |
|---|---|
| `/cards/search` | 2/s (intervalo 500 ms) |
| `/cards/named` | 2/s (500 ms) |
| `/cards/random` | 2/s (500 ms) |
| `/cards/collection` | 2/s (500 ms) |
| `/cards/manifest` | 10/min (6 s) |
| Demais métodos (`/cards/:id`, autocomplete, sets, rulings, `/bulk-data`, etc.) | 10/s (100 ms) |

Excesso → HTTP **429**. A partir daí o acesso fica limitado por **30 segundos**. Ignorar 429 e continuar sobrecarregando pode gerar ban temporário ou permanente. Reduza o ritmo; não faça retry imediato em loop.

Prática no app:

- Fila com no máximo 1 request de busca/named/collection a cada 500 ms (margem: 600 ms).
- Autocomplete no máximo ~8–10/s, com debounce na UI (não dispare a cada tecla sem espera).
- Cache local de JSON de carta por pelo menos **24 h**. Dados de gameplay (nome, Oracle, custo) mudam pouco: 1 vez por semana, ou após lançamento de set, costuma bastar.
- Se precisar resolver **muitos** nomes, preços ou imagens de uma vez, use bulk data — a documentação exige isso nesses casos.

### Outras regras

- `pretty=true` só para debug. Não use em produção.
- Query `q` tem no máximo **1000** caracteres Unicode e **precisa ser URL-encoded** (`:` → `%3A`, espaço → `+` ou `%20`).
- `collector_number` é string (pode ter letra ou `★`). Encode na URL.
- Não republique a base “como está”. O software tem que agregar valor (coleção, deck, canvas) — e não pode colocar dados da Scryfall atrás de paywall, assinatura ou cadastro obrigatório. Acesso anônimo ou conta gratuita precisa chegar nos dados de carta.

---

## 3. Endpoints que vamos usar primeiro

Todas as URLs abaixo são absolutas. Respostas JSON, salvo `format=image`.

### 3.1 Autocomplete — barra de busca

`GET /cards/autocomplete`

Desenhado para UI de digitação livre. Retorna um Catalog com até **20 nomes em inglês**, melhor match primeiro, favorecendo prefixo. Espaço, pontuação e caixa são ignorados.

| Query | Obrigatório | Notas |
|---|---|---|
| `q` | sim | Se tiver menos de 2 caracteres, ou nenhum match, `data` vem vazio — **não é erro**. |
| `include_extras` | não | `true` inclui tokens, planes, vanguards, etc. Default `false`. |

```http
GET https://api.scryfall.com/cards/autocomplete?q=light
User-Agent: MTGHelper/0.1
Accept: application/json
```

Resposta resumida (recorte real):

```json
{
  "object": "catalog",
  "total_values": 20,
  "data": ["Lightform", "Light 'Em Up", "Lightning Bolt"]
}
```

Não devolve imagem nem `id`. Depois que o usuário escolhe um nome, resolva a carta com `/cards/named` ou `/cards/search`.

### 3.2 Busca — filtros de coleção / deck / upgrade

`GET /cards/search` — **2/s**

Lista paginada de Cards. Mesmo com 1 resultado, o envelope é um List. Página de **175** cartas.

| Query | Default | Uso no app |
|---|---|---|
| `q` | — | Sintaxe da seção 6. Encode. |
| `unique` | `cards` | `cards` = uma cópia por objeto de jogo (nome + função). `art` = uma por ilustração. `prints` = todas as impressões (coleção física). |
| `order` | `name` | `cmc`, `released`, `rarity`, `usd`, `edhrec`, etc. |
| `dir` | `auto` | `asc` / `desc`. |
| `include_extras` | `false` | Tokens, planes, etc. |
| `include_multilingual` | `false` | Todas as línguas. |
| `include_variations` | `false` | Variantes raras. |
| `page` | `1` | Ou siga `next_page` (URI completa). |
| `format` | `json` | Também `csv`. |

Envelope List: `object`, `data[]`, `has_more`, `next_page` (se houver), `total_cards`, `warnings` (não fatais — corrija e reenvie se importar).

```http
GET https://api.scryfall.com/cards/search?order=cmc&q=c%3Ared+t%3Acreature+pow%3D3
```

Não use este endpoint para autocomplete letra a letra. Para “todas as impressões de um oráculo”, use `prints_search_uri` da carta ou `q=oracleid:<uuid>&unique=prints`.

### 3.3 Named lookup — um nome → uma carta

`GET /cards/named` — **2/s**

Feito para bots e resolução rápida. Retorna **um** Card (não uma lista).

| Query | Notas |
|---|---|
| `exact` | Nome exato, case-insensitive, pontuação opcional (`smugglers copter` = `Smuggler's Copter`). Sem match → 404. |
| `fuzzy` | Aceita typo e palavra parcial (`jac bele` → `Jace Beleren`). Só retorna carta se o servidor estiver **confiante** de um único nome. Caso contrário 404 com `type` (`ambiguous` se mais de um). |
| `set` | Restringe a impressão a um set code. |
| `format` | `json` (default), `text` ou `image`. |
| `version` | Com `format=image`: `small`, `normal`, `large`, `png`, `art_crop`, `border_crop`. Default `large`. |
| `face` | Com `format=image`, `back` pede a face de trás. Sem verso → **422**. |

Não envie `exact` e `fuzzy` ao mesmo tempo; escolha um.

```http
GET https://api.scryfall.com/cards/named?exact=Lightning+Bolt
```

Isso devolve **uma impressão** (no momento da consulta, uma Lightning Bolt recente de `msc`), não “a carta abstrata”. Para a edição que o jogador tem, passe `set` ou use set + collector number.

`format=image` não devolve JSON: a API **redireciona** para o arquivo. Prefira as URLs já prontas em `image_uris` e deixar o browser falar com `cards.scryfall.io`.

### 3.4 Identificadores estáveis

`GET /cards/:id` — Scryfall UUID da **impressão**. 10/s.

```http
GET https://api.scryfall.com/cards/56ebc372-aabd-4174-a943-c7bf59e5028d
```

`GET /cards/:code/:number` e opcional `/:lang`:

```http
GET https://api.scryfall.com/cards/xln/96
GET https://api.scryfall.com/cards/dom/1/ja
```

`:code` tem 3 a 5 letras. `:number` é string. `:lang` é código de 2–3 caracteres.

Outros lookups, se a fonte já tiver o id: `GET /cards/multiverse/:id`, `GET /cards/arena/:id`. Mesmos query params de imagem (`format`, `version`, `face`).

### 3.5 Collection — lote (importar deck / lista)

`POST /cards/collection` — **2/s**, JSON only. Máximo **75** identificadores por request.

```http
POST https://api.scryfall.com/cards/collection
Content-Type: application/json

{
  "identifiers": [
    { "id": "683a5707-cddb-494d-9b41-51b4584ded69" },
    { "name": "Ancient Tomb" },
    { "set": "mrd", "collector_number": "150" }
  ]
}
```

Esquemas válidos (um objeto pode usar só um esquema):

| Chaves | Resolve |
|---|---|
| `id` | Impressão exata (Scryfall UUID). |
| `oracle_id` | Edição **mais nova** daquele oráculo. |
| `illustration_id` | Scan preferida daquela arte. |
| `name` | Edição **mais nova** daquele nome. |
| `name` + `set` | Nome naquele set. |
| `collector_number` + `set` | Impressão física. `collector_number` é string. |
| `mtgo_id` | `mtgo_id` ou `mtgo_foil_id`. |
| `multiverse_id` | Qualquer id em `multiverse_ids`. |

Cada identificador devolve no máximo uma carta. Não encontrados vão para `not_found`. A ordem de `data` segue o pedido, mas faltantes **desalinha índice** — não mapeie só por posição. Guarde o identificador enviado junto do resultado (ou case por `id` / set+número).

Deck de 100 cartas = 2 posts (75 + 25), com 500 ms entre eles.

### 3.6 Sets, rulings, relacionadas

`GET /sets` — lista de sets. `GET /sets/:code` — um set (ex.: `GET /sets/aer`).

Campos úteis: `code`, `name`, `released_at`, `set_type`, `card_count`, `icon_svg_uri`, `search_uri`. Ícone SVG: a documentação pede para **baixar e servir localmente**; hotlink do ícone não é recomendado (a arte pode mudar).

Rulings: use `rulings_uri` do Card. Formas documentadas:

```http
GET https://api.scryfall.com/cards/cma/176/rulings
GET https://api.scryfall.com/cards/{id}/rulings
```

Cada ruling: `oracle_id`, `source` (`wotc` ou `scryfall`), `published_at`, `comment`. Cartas com o mesmo nome compartilham rulings.

`all_parts` (quando existe): peças relacionadas — `token`, `meld_part`, `meld_result`, `combo_piece` — com `id`, `name`, `type_line`, `uri`. Use para mostrar token/emblema gerado, não para listar a coleção.

---

## 4. Objeto Card — campos essenciais

`object` é sempre `"card"`. Guarde o JSON completo no cache; na UI, estes campos bastam.

### Identidade

| Campo | Para quê |
|---|---|
| `id` | UUID da **impressão**. Chave de coleção física e de imagem desta scan. |
| `oracle_id` | Identidade de jogo, estável entre reprints. Ausente no layout `reversible_card` (fica em cada face). |
| `name` | Nome. Multifaces: as duas metades com ` // ` (espaço, barra, espaço). |
| `lang` | Idioma desta impressão (`en`, `pt`, `ja`, …). |
| `layout` | Como ler faces e imagens. Ver seção 5. |
| `scryfall_uri` | Página permanente no site. Útil para “abrir no Scryfall” e atribuição. |
| `uri` | Este objeto na API. |
| `prints_search_uri` | Começa a paginar reprints. |
| `rulings_uri` | Lista de rulings. |

Três ids, três perguntas:

- “Qual cópia/scan é esta?” → `id`
- “É a mesma carta para deck legality / upgrade?” → `oracle_id` (e o `name` Oracle)
- “Qual fólio da caixa?” → `set` + `collector_number` (+ `lang` se não for inglês)

`illustration_id` permanece igual quando a arte é reimpressa. `reprint: true` marca impressão que não é a primeira.

### Gameplay (deck check e upgrade)

| Campo | Notas |
|---|---|
| `mana_cost` | String tipo `{2}{U}{U}`. `""` = sem custo (diferente de `{0}`). Em multiface, vem nas faces, não no topo. |
| `cmc` | Mana value (decimal; algumas cartas engraçadas são fracionárias). |
| `type_line` | No topo de DFC, junta as faces com ` // `. |
| `oracle_text` | Pode ser null. Em DFC, está em `card_faces`. |
| `colors` | Cores da carta, se as regras definem cor no objeto inteiro. Senão, nas faces. Nullable. |
| `color_identity` | Sempre no objeto raiz. Use para Commander. |
| `color_indicator` | Nullable. |
| `keywords` | Ex.: `Flying`, `Transform`. |
| `power` / `toughness` / `loyalty` | Strings (`"*"`, `"X"`). Em DFC, nas faces. |
| `legalities` | Mapa formato → `legal` \| `not_legal` \| `restricted` \| `banned`. |
| `reserved` | Reserved List. |
| `produced_mana` | Mana que a carta pode gerar. |
| `card_faces` | Faces, se multiface. |
| `all_parts` | Relacionadas (token, meld, combo). |

### Impressão (coleção e canvas)

| Campo | Notas |
|---|---|
| `set` | Código (`soi`, `xln`). |
| `set_name` | Nome do set. |
| `collector_number` | String. |
| `rarity` | `common`, `uncommon`, `rare`, `special`, `mythic`, `bonus`. |
| `artist` / `artist_ids` | Obrigatório exibir com `art_crop`. Pode faltar em spoilers. |
| `image_uris` | Ver seção 5. **Ausente no topo de carta dos dois lados.** |
| `image_status` | `missing`, `placeholder`, `lowres`, `highres_scan`. |
| `highres_image` | Boolean. |
| `prices` | Objeto diário. Valores **string ou null**: `usd`, `usd_foil`, `usd_etched`, `eur`, `eur_foil`, `eur_etched`, `tix`. Converta para número só na UI. |
| `finishes` | `foil`, `nonfoil`, `etched`. |
| `border_color` | `black`, `white`, `borderless`, `yellow`, `silver`, `gold`. |
| `frame` | Ex.: `2015`. |
| `promo`, `digital`, `oversized`, `booster`, `games` | `games`: `paper`, `arena`, `mtgo`, `astral`, `sega`. |
| `content_warning` | Se `true`, evite usar essa impressão downstream. |
| `printed_name` / `printed_text` / `printed_type_line` | Texto impresso localizado. |

### Face (`card_faces[]`)

`object`: `card_face`. Campos que o canvas precisa: `name`, `mana_cost`, `type_line`, `oracle_text`, `colors`, `color_indicator`, `power`, `toughness`, `loyalty`, `artist`, `image_uris`, `flavor_text`.

`oracle_text` / `mana_cost` no raiz podem estar ausentes mesmo quando a carta “tem” esses dados — leia a face.

---

## 5. URI de imagem para o canvas

Origem das scans: `https://cards.scryfall.io/...`. Não passa pelo rate limit da API. As URLs reais incluem query de versão (`?1783903008`); trate a string inteira como cache key, não só o path.

Chaves em `image_uris` (carta normal, conferido em Lightning Bolt):

| Chave | Tamanho / formato | Quando usar |
|---|---|---|
| `thumb` | 146×204 WEBP | Lista densa. Substitui `small`. |
| `small` | 146×204 JPG | Fallback se o canvas não aceitar WEBP. |
| `grid` | 488×680 WEBP | Grade do deck / coleção. Substitui `normal`. |
| `normal` | 488×680 JPG | Grade, fallback JPG. **Padrão recomendado** se a stack de imagem for só JPG. |
| `display` | 672×936 WEBP | Zoom / inspeção. Substitui `large`. |
| `large` | 672×936 JPG | Zoom JPG. Default de `format=image`. |
| `crop` | 480×680 WEBP | Carta sem a maior parte da borda. Substitui `border_crop`. |
| `border_crop` | 480×680 JPG | Contextos que não desenham canto arredondado. |
| `png` | 744×1040 PNG | Transparência, canto arredondado. Melhor para overlay. Arquivo maior. |
| `art` | 626×457 WEBP | Só a arte. Substitui `art_crop`. |
| `art_crop` | varia, JPG | Só a arte. Recorte não é perfeito em frames estranhos. |

`format=image&version=` aceita só `small`, `normal`, `large`, `png`, `art_crop`, `border_crop` — não `thumb`/`grid`/`display`. Para WEBP, use as URIs do JSON.

### Escolha por superfície

- Lista / typeahead: `thumb` ou `small`. Não baixe `png` aqui.
- Grade de deck ou coleção: `grid` ou `normal`.
- Painel de detalhe / canvas grande: `display` ou `large`; `png` só se precisar de alpha.
- Fundo decorativo: `art` / `art_crop` **e** mostre artista + copyright na mesma tela, ou mostre a carta completa em outro ponto da mesma interface. `artist` está no Card (ou na face). Copyright é o da Wizards impresso na carta — não corte essa faixa.

### Duas faces e layouts

`image_uris` no **raiz** existe quando a imagem é de um lado só (carta `normal`, split, flip, adventure, etc.).

Em carta **de dois lados**, `image_uris` **não vem no topo**. Está em cada item de `card_faces`. Conferido em Arlinn Kord (`layout: "transform"`): raiz sem `image_uris`; `card_faces[0].image_uris` = frente (`/front/`); `card_faces[1].image_uris` = verso (`/back/`).

Layouts que sempre têm `card_faces`: `split`, `flip`, `transform`, `double_faced_token`. Também usam faces: `modal_dfc`, `reversible_card`, `art_series`, meld (frente nas faces / partes em `all_parts`).

Regra prática no canvas:

```text
se card.image_uris:
  mostrar card.image_uris.normal   # uma imagem (inclui split/flip)
senão se card.card_faces:
  frente = card.card_faces[0].image_uris
  verso  = card.card_faces[1]?.image_uris
  # flip do canvas troca frente/verso; não assuma image_uris no pai
```

`GET /cards/:id?format=image&face=back` só se você não tiver o JSON. Sem verso → 422.

`image_status`:

- `missing` — ainda processando (spoilers). Não desenhe imagem quebrada.
- `placeholder` — comum em localização. Avise o usuário.
- `lowres` — usável, qualidade baixa.
- `highres_scan` — scan boa.

### Regras de imagem (site que exibe scans)

Obrigatório, da política de uso da API:

- Não cobrir, recortar ou cortar copyright ou nome do artista na imagem da carta.
- Não distorcer, inclinar ou esticar (preserve aspect ratio  ~ 5:7 nas cartas cheias).
- Não borrar, sharpen, dessaturar ou mudar cor.
- Não colocar watermark, carimbo ou logo seu por cima.
- Não sugerir que a carta é de outro jogo ou de outro criador que não a Wizards.
- Com `art_crop` / `art`, listar artista e copyright na mesma UI, ou mostrar a carta inteira na mesma interface.
- Não usar logo ou nome “Scryfall” como se eles endossassem o MTG Helper.

O ícone de set (`icon_svg_uri`) é o caso em que hotlink é desencorajado. As URIs de carta em `cards.scryfall.io` são o jeito previsto de exibir imagens; mesmo assim, cacheie no cliente (e não rebaixe a API só para descobrir a URL de novo).

---

## 6. Sintaxe de busca útil

Referência: [Search Reference](https://scryfall.com/docs/syntax). Passe a string em `q`, sempre encoded. Termos se combinam com AND implícito. `or` / `OR` e parênteses agrupam. `-` nega (exceto `include`). `!` é nome exato (`!fire` = a carta Fire, não “Fireball”).

| Intenção | Operador | Exemplo (antes de encode) |
|---|---|---|
| Nome | palavras soltas, ou `!` | `lightning bolt` · `!"Lightning Bolt"` |
| Cor | `c:` / `color:` | `c:red` · `c:wu` · `c>=uw -c:red` |
| Identidade de cor | `id:` / `identity:` | `id:esper` · `id<=wur` |
| Tipo | `t:` / `type:` | `t:creature` · `t:legend` · `t:goblin -t:creature` |
| Texto Oracle | `o:` / `oracle:` | `o:draw` · `o:"~ enters tapped"` (`~` = nome da carta) |
| Palavra-chave | `kw:` / `keyword:` | `kw:flying` |
| Mana value | `mv` / `manavalue` / `cmc` | `mv=1` · `mv<=3` · `mv:even` |
| Custo | `m:` / `mana:` | `m:{R}` · `m:2WW` |
| Formato legal | `f:` / `format:` | `f:modern` · `f:commander` · `f:pauper` |
| Banido / restrito | `banned:` / `restricted:` | `banned:legacy` |
| Raridade | `r:` | `r:mythic` · `r>=r` |
| Set / número | `e:` / `s:` · `cn:` | `e:war` · `e:xln cn:96` |
| Poder | `pow` / `power` | `pow=3` · `pow>=8` |
| Reprint | `is:reprint` / `not:reprint` | `!"Lightning Bolt" unique:prints` |
| Papel | `game:paper` | `f:modern game:paper` |
| Língua | `lang:` | `lang:pt` · `lang:any` (API de search **não** faz isso sozinha) |
| Extras | `include:extras` | tokens, planes, memorabilia |
| Comandante | `is:commander` | `id:wubrg is:commander` |

Exemplos prontos (path já encoded onde importa):

```http
GET /cards/search?q=c%3Ared+t%3Acreature+pow%3D3&order=cmc
GET /cards/search?q=f%3Amodern+t%3Ainstant+mv%3C%3D2&unique=cards
GET /cards/search?q=%21%22Lightning+Bolt%22&unique=prints
GET /cards/search?q=id%3Abant+t%3Acreature+f%3Acommander&order=edhrec
GET /cards/search?q=o%3Adraw+t%3Acreature+c%3Au
```

Armadilhas da API vs site:

- Zero resultados **não** dispara retry com extras/qualquer língua.
- Busca só de set (`e:set`) não redireciona para galeria `unique:prints`.
- Não há “swizzle” de impressão mais barata nem ajuda de grafia.
- Default `unique=cards` esconde reprints. Coleção física precisa de `unique=prints` (ou `name`+`set` via collection).

Formatos documentados para `f:`: `standard`, `future`, `historic`, `timeless`, `gladiator`, `pioneer`, `modern`, `legacy`, `pauper`, `vintage`, `penny`, `commander`, `oathbreaker`, `standardbrawl`, `brawl`, `competitivebrawl`, `alchemy`, `paupercommander`, `duel`, `oldschool`, `premodern`, `predh`, `tlr`.

---

## 7. Estratégia recomendada no app

Ordem para a primeira versão (busca + imagens), sem bulk:

1. **Autocomplete** (`/cards/autocomplete`) com debounce (~200–300 ms) e só a partir de 2 caracteres. Cache de prefixo na sessão.
2. Usuário escolhe um nome → `GET /cards/named?exact=<nome>` (ou `fuzzy` só se a busca livre não veio do catálogo).
3. Guarde o Card (especialmente `id`, `oracle_id`, `set`, `collector_number`, `image_uris` ou `card_faces[].image_uris`) por ≥ 24 h.
4. O canvas lê a URI já resolvida em `cards.scryfall.io`. Não chame a API de novo para cada tile.
5. Filtros (“vermelhas, CMC ≤ 3, Modern”) vão para `/cards/search`, não para N chamadas `named`.
6. Paginação: se `has_more`, GET em `next_page`. Não monte a página 50 no load inicial.

### Quando usar `/cards/collection`

- Importar decklist ou lista de coleção já com identificadores (até 75 por POST).
- O usuário digitou `set` + número (`mrd` / `150`) ou você tem Scryfall `id` salvos.
- Resolver vários `oracle_id` para “edição mais nova” de uma vez (upgrade / checklist), sabendo que isso **não** preserva a impressão da coleção.
- Não use collection para typeahead. Não use search para 40 nomes exatos se você já tem `id` ou set+número — collection é o lote certo.

### Quando considerar bulk data (depois, não agora)

`GET /bulk-data` lista arquivos. Cada item tem `type`, `updated_at`, `jsonl_download_uri` (`.jsonl.gz`, JSON Lines), `compressed_size`. URLs mudam de timestamp todo dia. Coleta a cada 12–24 h.

Arquivos (tamanhos da doc em 2026-09-09, mudam):

| Tipo | Uso futuro |
|---|---|
| Oracle Cards | Uma carta por `oracle_id` — deck check / upgrades sem reprints. |
| Unique Artwork | Melhor scan por arte. |
| Default Cards | Inglês, ou a língua única se não houver inglês. Cache de coleção “padrão”. |
| All Cards | Todas as línguas. Grande (~374 MB comprimido). |
| Rulings | Rulings ligadas por `oracle_id`. |

Use bulk quando o app precisar resolver muitos nomes/preços/imagens sem martelar `/cards/search`. Preços do arquivo: só tendência, nunca vitrine. Gameplay: baixar semanalmente ou após set novo é suficiente. `/cards/manifest` (10/min, 15 000 por página) serve para ver o que mudou; hidrate cartas com os outros métodos. Não baixe All Cards na primeira entrega.

### IDs que o app deve persistir

- Slot de coleção: `id` + `set` + `collector_number` + `lang` + finish escolhida pelo usuário (`finishes`).
- Linha de deck (versão de jogo): `oracle_id` + quantidade; imagem pode ser a impressão preferida (`prefer:newest` na busca, ou a `id` que o usuário fixou).
- Nunca use só `name` como chave: tokens e Unstable podem repetir nome. `oracle_id` distingue funções; `id` distingue impressões.

---

## 8. Armadilhas

- **429.** Search/named/collection a 2/s. Depois de 429, pare ~30 s. Não ignore.
- **Query sem encode.** `c:red` na URL quebra. Use `c%3Ared`. Nomes com `'` , `/` e unicode precisam de encode. Limite de 1000 caracteres em `q`.
- **DFC sem `image_uris` no topo.** Olhar só o raiz quebra o canvas. Layouts `transform` e `modal_dfc` põem imagens (e quase todo o texto de jogo) em `card_faces`. `name` / `type_line` do raiz usam ` // `.
- **`colors` vs `color_identity`.** Cor pode estar só na face. Identidade de cor está no raiz — use essa para Commander.
- **`id` ≠ `oracle_id` ≠ nome.** `named` e `collection` com só `name` devolvem **uma** impressão (no collection, a mais nova). A coleção do jogador pode ser outra arte/set. `unique=cards` na busca também colapsa reprints.
- **`oracle_id` em `reversible_card`.** Não está no raiz; cada face tem o seu. Não são um único objeto de deck.
- **`collector_number` não é int.** `"96"`, `"150a"`, `"★"`. No collection, mande string.
- **Search ≠ site.** Sem fuzzy, sem extras automático, sem `lang:any` automático, sem sugestão de grafia. `fuzzy` é só em `/cards/named`. Autocomplete não retorna erro para string curta.
- **Uma carta na busca ainda é List.** Leia `data[0]`, não trate o body como Card.
- **`not_found` no collection.** Não indexe `data[i]` como se fosse `identifiers[i]`.
- **`face=back` em carta de um lado** → 422.
- **Preços string/null e diários.** `"0.71"`, não `0.71`. `usd_etched` pode ser `null`. Não recarregue a carta o dia todo por causa de preço.
- **Spoilers.** `image_status: missing`, `artist` nulo, `highres_image: false`.
- **`content_warning`.** Não exiba essa impressão por padrão.
- **Idioma.** Default é inglês. Autocomplete é só nome inglês. Carta PT precisa de `lang` no collector, `include_multilingual` ou `lang:` na busca.
- **Split/flip têm `card_faces` mas uma imagem.** A scan única fica em `image_uris` do pai. Não espere `image_uris` em cada face de split.
- **Paginação.** Pare em `has_more === false`. `total_cards` é o total, não o tamanho da página (175).
- **Erros.** Body de erro (4xx/5xx): `status`, `code`, `details`, `type` (ex.: `ambiguous` no 404 do fuzzy), `warnings`. Mostre `details` ao usuário; use `type` no código.

Exemplo de busca que a própria doc usa para gerar erro com warnings: `GET /cards/search?q=is%3Aslick+cmc%3Ecmc`.

---

## Fontes consultadas

Documentação e respostas reais usadas para este arquivo (não inferir endpoints fora desta lista):

- https://scryfall.com/docs/api
- https://scryfall.com/docs/api/authentication
- https://scryfall.com/docs/api/rate-limits
- https://scryfall.com/docs/api/images
- https://scryfall.com/docs/api/layouts
- https://scryfall.com/docs/api/cards
- https://scryfall.com/docs/api/cards/search
- https://scryfall.com/docs/api/cards/named
- https://scryfall.com/docs/api/cards/collection
- https://scryfall.com/docs/api/cards/autocomplete
- https://scryfall.com/docs/api/cards/id
- https://scryfall.com/docs/api/cards/collector
- https://scryfall.com/docs/api/cards/multiverse
- https://scryfall.com/docs/api/errors
- https://scryfall.com/docs/api/lists
- https://scryfall.com/docs/api/sets
- https://scryfall.com/docs/api/sets/all
- https://scryfall.com/docs/api/rulings
- https://scryfall.com/docs/api/catalogs
- https://scryfall.com/docs/api/bulk-data
- https://scryfall.com/docs/syntax
- https://api.scryfall.com/cards/named?exact=Lightning+Bolt
- https://api.scryfall.com/cards/b37aa12c-a6b3-4cf8-b5a4-0a999ff12d02
- https://api.scryfall.com/cards/autocomplete?q=light
