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
- [ ] Sessão iniciada após cadastro.

### US-003-02 — Entrar e sair

**Como** usuário cadastrado **quero** entrar e sair **para** acessar meus dados com segurança básica.

Critérios de aceite:

- [ ] Credencial inválida → 401.
- [ ] Cookie `mtg_session` httpOnly.
- [ ] Logout remove a sessão.
- [ ] `GET /api/auth/me` reflete o usuário atual.

### US-003-03 — Rotas protegidas

**Como** sistema **quero** redirecionar não autenticados **para** `/entrar`.

Critérios de aceite:

- [ ] `/decks*` e `/colecao*` exigem cookie.
- [ ] Query `next` preserva destino após login.

## Regras

- Sem paywall sobre dados públicos de carta (Scryfall).
- Auth só protege dados do usuário.

## Superfície

- UI: `/cadastro`, `/entrar`, header do `AppShell`
- API: `/api/auth/register`, `/login`, `/logout`, `/me`
- Lib: `src/lib/auth.ts`
- Dados: tabela `users`
