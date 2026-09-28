<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Features e user stories

Todo código de produto deve estar ligado a uma feature (`F-XXX`) ou user story (`US-XXX`) em `docs/features/`.

Se o pedido não citar uma feature: peça a referência ou pergunte se deve criar uma nova spec antes de implementar. Regra completa: `.cursor/rules/feature-traceability.mdc`.

## Fluxo de criação de feature

Siga esta ordem, sem pular etapas:

1. **Spec**: crie `docs/features/F-XXX-slug.md` com objetivo, escopo, user stories e critérios de aceite.
2. **Documentação**: atualize o índice `docs/features/README.md`, a tabela de `.cursor/rules/feature-traceability.mdc` e specs relacionadas.
3. **Dúvidas**: liste as decisões em aberto na spec e confirme com o usuário antes de codar; registre as respostas na spec.
4. **Branch**: crie uma branch nova a partir da `main` para a feature.
5. **Implementação**: código ligado aos IDs `F-XXX` / `US-XXX`.
6. **Testes**: typecheck, lint, build e teste Playwright do fluxo; marque os critérios de aceite atendidos na spec.
