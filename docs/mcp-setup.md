# MCP (ferramentas do Cursor)

A configuracao MCP **nao e versionada** neste repositorio (`.cursor/mcp.json` esta no `.gitignore`).
Use o MCP global da maquina: `~/.cursor/mcp.json` (no Windows: `%USERPROFILE%\.cursor\mcp.json`).

## Servidores usados neste projeto

- **Scryfall** (`scryfall`): busca e dados de cartas de Magic: The Gathering (texto, nome, ID, regras e precos). Pacote: `scryfall-mcp-server`.
- **Google Stitch** (`stitch`): geracao e edicao de layouts/telas no Stitch. Servidor remoto HTTP em `https://stitch.googleapis.com/mcp`.

## Exemplo de bloco (local)

```json
{
  "mcpServers": {
    "scryfall": {
      "type": "stdio",
      "command": "npx",
      "args": ["scryfall-mcp-server"]
    },
    "stitch": {
      "url": "https://stitch.googleapis.com/mcp",
      "headers": {
        "X-Goog-Api-Key": "${env:STITCH_API_KEY}"
      }
    }
  }
}
```

Fontes:

- Scryfall: snippet `npx` do [README](https://github.com/cryppadotta/scryfall-mcp) (`command`: `npx`, `args`: `["scryfall-mcp-server"]`). `type: "stdio"` e o formato de servidor local do Cursor.
- Stitch: bloco oficial em [Setup & Authentication](https://stitch.withgoogle.com/docs/mcp/setup). Prefira `${env:STITCH_API_KEY}` em vez de chave hardcoded. Ver [docs de MCP do Cursor](https://cursor.com/docs/context/mcp).

## O que voce precisa fazer localmente

### Scryfall

Nao usa API key. O servidor publico do Scryfall nao exige token nesta configuracao.

1. Instale Node.js e confirme que `npx` funciona no terminal (`npx --version`).
2. Abra o projeto no Cursor. Na primeira conexao, o `npx` baixa o pacote `scryfall-mcp-server`.
3. Em Cursor: Settings → MCP, confira o servidor `scryfall` e reinicie o Cursor se ele nao conectar sozinho.

### Stitch (API key — metodo recomendado pela documentacao oficial)

1. Abra [Stitch Settings](https://stitch.withgoogle.com/settings).
2. Va ate a secao **API Keys**.
3. Clique em **Create API Key** e copie a chave. Nao a commite.
4. Defina a variavel de ambiente de usuario do Windows `STITCH_API_KEY` com essa chave (Configuracoes → Sistema → Sobre → Configuracoes avancadas do sistema → Variaveis de Ambiente). Um arquivo `.env` do projeto **nao** e lido automaticamente por servidor remoto.
5. Feche o Cursor por completo e abra de novo, para o processo enxergar a variavel.
6. Em Settings → MCP, o servidor `stitch` deve aparecer. Teste pedindo para listar projetos Stitch (`list_projects`).

O arquivo `.env.example` so documenta o nome da variavel. Copie para `.env` se quiser um lembrete local, mas isso sozinho nao autentica o Stitch remoto.

OAuth (`Authorization: Bearer` + `X-Goog-User-Project`, com `STITCH_ACCESS_TOKEN` e `GOOGLE_CLOUD_PROJECT`) e o metodo alternativo da mesma pagina. Nao foi configurado aqui: o token expira em cerca de 1 hora e a documentacao pede atualizacao manual do header.

## Tools do Scryfall

Nomes expostos no README de `cryppadotta/scryfall-mcp`:

- `search_cards` — busca textual; lista cartas correspondentes
- `get_card_by_id` — carta pelo UUID do Scryfall
- `get_card_by_name` — carta pelo nome exato em ingles
- `random_card` — carta aleatoria
- `get_rulings` — rulings oficiais da carta
- `get_prices_by_id` — precos (USD, USD foil, EUR, TIX) por ID
- `get_prices_by_name` — precos por nome exato

## Tools do Stitch

Nomes na pagina de setup (esquemas completos em [Reference](https://stitch.withgoogle.com/docs/mcp/reference)):

- `create_project`
- `get_project`
- `list_projects`
- `list_screens`
- `get_screen`
- `generate_screen_from_text`
- `edit_screens`
- `generate_variants`
- `create_design_system`
- `update_design_system`
- `list_design_systems`
- `apply_design_system`

O [guia](https://stitch.withgoogle.com/docs/mcp/guide) nao muda a config: assume autenticacao pronta e mostra como pedir projetos, HTML e imagens das telas.

## Limitacoes

- **Scryfall e stdio local.** O Cursor inicia `npx scryfall-mcp-server`. O README tambem documenta Docker (`docker run -i --rm mcp/scryfall` apos `docker build`) e modo SSE (`--sse` em `http://localhost:3000/sse`). Aqui foi usado o metodo `npx` do README, sem clone local.
- O pacote npm publicado e `scryfall-mcp-server` (0.1.1). O README nao declara versao minima do Node. O pacote e ESM (`"type": "module"`).
- No Windows, se o Cursor nao achar `npx`, o executavel costuma ser `npx.cmd`. O README usa `npx`; so troque se a conexao falhar por comando nao encontrado.
- **Stitch e remoto HTTP (nao SSE, nao stdio).** Precisa de rede e da API key. Cursor nao aceita `envFile` em servidor remoto: `${env:STITCH_API_KEY}` vem do ambiente do sistema/shell, nao de `.env`.
- Nao coloque a chave real em `.cursor/mcp.json`.
