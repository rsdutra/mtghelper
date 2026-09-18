# MTG Helper

Site desktop para jogadores de Magic: The Gathering: organizar coleções, conferir decks e planejar upgrades. A interface principal é um canvas para dispor imagens de cartas, com um painel de filtros ao lado.

## Como rodar

As dependências já estão instaladas. Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Em outra máquina, rode `npm install` antes.

Outros comandos:

- `npm run build` — gera a versão de produção
- `npm run start` — serve a build de produção
- `npm run lint` — verifica o código com ESLint

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- tldraw
- TanStack Query

## Documentação

- [Features e user stories](docs/features/README.md)
- [API Scryfall](docs/scryfall-api.md)
- [Configuração MCP](docs/mcp-setup.md)
