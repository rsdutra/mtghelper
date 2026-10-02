# F-003 — Cadastro e autenticação

## Objetivo

Permitir conta simples com login e senha (V1), sem validação de e-mail, para proteger decks e coleção.

## Escopo

- Registro com login + senha.
- Login / logout com sessão em cookie HTTP-only (JWT).
- Criação automática de coleção padrão no registro.
- Middleware bloqueando `/decks` e `/colecao` sem sessão.

## Fora de escopo

- E-mail, reset de senha, OAuth, 2FA.
- Papéis/admin.
- Contas anônimas persistentes.

## User stories

### US-003-01 — Criar conta

**Como** jogador **quero** me cadastrar com login e senha **para** salvar decks e coleção.

Critérios de aceite:

- [ ] Login ≥ 3 caracteres, senha ≥ 4.
- [ ] Senha armazenada com hash (`bcrypt`).
- [ ] Login duplicado retorna erro claro.
- [ ] Cria coleção "Minha coleção".
- [x] Sessão iniciada após cadastro.
- [ ] Cookie antigo que não corresponde a um usuário no banco não impede abrir `/cadastro`. Sessão válida continua indo para `/`.
- [x] Após cadastrar, abre `/decks` já autenticado, também na build de produção (com prefetch dos links do header).

### US-003-02 — Entrar e sair

**Como** usuário cadastrado **quero** entrar e sair **para** acessar meus dados com segurança básica.

Critérios de aceite:

- [ ] Credencial inválida → 401.
- [ ] Cookie `mtg_session` httpOnly.
- [x] Logout remove a sessão.
- [ ] `GET /api/auth/me` reflete o usuário atual.
- [x] Após entrar, abre o destino já autenticado, sem cair de novo em `/entrar`.
- [x] Após sair, páginas protegidas pré-carregadas com sessão não são reaproveitadas.

### US-003-03 — Rotas protegidas

**Como** sistema **quero** redirecionar não autenticados **para** `/entrar`.

Critérios de aceite:

- [ ] `/decks*` e `/colecao*` exigem cookie.
- [x] Query `next` preserva destino após login.
- [x] `next` só aceita caminho interno; outro valor cai em `/decks`.

## Regras

- Sem paywall sobre dados públicos de carta (Scryfall).
- Auth só protege dados do usuário.
- Cadastro, login e logout da UI são Server Actions: gravar ou apagar o cookie numa Server Action invalida o Client Cache do roteador, e o `redirect` navega na mesma resposta.

## Decisões

- **Redirecionamento após cadastro/login (2026-10-02).** Na build de produção, o Next pré-carrega `/decks` pelo header ainda sem sessão; o middleware responde com redirect para `/entrar` e o roteador guarda isso. Com `fetch` + `router.push("/decks")` + `router.refresh()` (que só limpa a rota atual), o usuário logado caía em `/entrar`. Opções avaliadas: Server Actions (escolhida), `prefetch={false}` nos links protegidos (trata o sintoma) e `window.location` (descartada por não usar o roteador).
- As rotas `/api/auth/*` continuam disponíveis e compartilham a lógica com as Server Actions (`registerUser` / `loginUser` em `src/lib/auth.ts`).

## Superfície

- UI: `/cadastro`, `/entrar`, header do `AppShell`
- API: `/api/auth/register`, `/login`, `/logout`, `/me`
- Server Actions: `src/lib/auth-actions.ts`
- Lib: `src/lib/auth.ts`
- Dados: tabela `users`
