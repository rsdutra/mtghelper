# Publicar MTG Helper na VPS Hostinger

Guia alinhado ao que já roda na sua KVM 2: **Docker Compose + Traefik (HTTPS) + imagens no GHCR**.

| Recurso | Valor |
|---------|--------|
| VPS | KVM 2 — `srv1919186.hstgr.cloud` (VM ID `1919186`) |
| IP | `187.127.61.176` |
| Template | Ubuntu 24.04 + Docker + Traefik |
| Repo | https://github.com/rsdutra/mtghelper |
| Projetos Docker | `mtghelper-db` (Postgres) e `mtghelper` (app) |
| URL pública (teste) | https://mtghelper.srv1919186.hstgr.cloud |

---

## Visão geral

```text
push em main
  → Action "Build and deploy"
      1. builda a imagem e publica ghcr.io/rsdutra/mtghelper:<sha> e :latest
      2. chama a API da Hostinger (hostinger/deploy-on-vps) com docker-compose.yml + env
  → VPS sobe o projeto `mtghelper` (web) na rede `mtghelper-db`
  → web fala com o container `mtghelper-postgres` (projeto `mtghelper-db`)
  → Traefik roteia Host(mtghelper.srv1919186.hstgr.cloud) → :3000 com Let’s Encrypt
```

A API Hostinger de projetos Docker **só recebe o compose + env** (não o código-fonte). Por isso a imagem precisa estar no GHCR e o schema SQL vai **dentro da imagem**, aplicado no start pelo entrypoint.

### Por que o banco é um projeto separado?

A API da Hostinger **substitui** o projeto a cada deploy. Com o Postgres em `mtghelper-db`, os deploys do app nunca recriam o container do banco nem arriscam o volume `postgres_data`. O projeto `mtghelper-db` cria a rede `mtghelper-db`; o app entra nela como rede externa.

### Por que esse hostname?

A Hostinger publica wildcard DNS `*.srv1919186.hstgr.cloud` → IP da VPS. É o padrão dos apps do Docker Catalog: sem domínio próprio, com HTTPS via Traefik. Não use o apex `srv1919186.hstgr.cloud` sozinho — reserve um subdomínio por app.

---

## Arquivos de deploy

| Arquivo | Função |
|---------|--------|
| `Dockerfile` | Build Next.js (`output: "standalone"`) + SQL + entrypoint |
| `.dockerignore` | Enxuga o contexto de build |
| `docker-compose.yml` | Projeto `mtghelper`: serviço `web` + labels Traefik |
| `deploy/postgres/docker-compose.yml` | Projeto `mtghelper-db`: Postgres 16 + rede `mtghelper-db` |
| `scripts/docker-entrypoint.sh` | Espera o banco, roda `scripts/migrate.mjs`, sobe o Next |
| `scripts/migrate.mjs` | Aplica `sql/schema.sql` e só as `sql/migrate_*.sql` pendentes (F-014) |
| `.github/workflows/publish-ghcr.yml` | Build/push no GHCR + deploy na VPS |

---

## Segredos

| Nome | Onde fica | Uso |
|------|-----------|-----|
| `POSTGRES_PASSWORD` | GitHub Secret + env do projeto `mtghelper-db` | Senha do usuário `mtghelper` no Postgres |
| `AUTH_SECRET` | GitHub Secret | Assinatura do JWT de sessão |
| `HOSTINGER_API_KEY` | GitHub Secret | Autoriza a Action a chamar a API da VPS |
| `HOSTINGER_VM_ID` | GitHub Variable (`1919186`) | VPS de destino |
| `STAGE_DATABASE_URL` | GitHub Secret | URL do banco de stage pela tailnet (`100.68.153.18:5434`), usada pelo job `migrate-stage` |
| `TS_OAUTH_CLIENT_ID` / `TS_OAUTH_SECRET` | GitHub Secret | OAuth client do Tailscale (escopo de escrita em Auth Keys, tag `tag:ci`) para o runner entrar na tailnet |

Cópia local dos valores de produção: bloco `PROD_*` no `.env` (fora do Git). O prefixo evita que o `next dev` use as credenciais de produção.

Banco de produção:

- Host (dentro da rede Docker): `mtghelper-postgres:5432`
- Banco / usuário: `mtghelper` / `mtghelper`
- Acesso de fora: só por túnel SSH para `127.0.0.1:5433` na VPS (`ssh -L 5433:127.0.0.1:5433 root@187.127.61.176`)

---

## Passo 1 — Subir o banco (uma vez)

Crie o projeto `mtghelper-db` com o conteúdo de `deploy/postgres/docker-compose.yml` e o env:

```env
POSTGRES_PASSWORD=<valor do secret POSTGRES_PASSWORD>
```

Via MCP Hostinger: `VPS_createNewProjectV1` com `virtualMachineId: 1919186`, `project_name: mtghelper-db`. Ou pelo hPanel → Docker Manager → Compose.

Só recrie este projeto se quiser trocar versão/config do Postgres. O volume `postgres_data` persiste enquanto o projeto não for removido com os volumes.

---

## Passo 2 — Imagem no GHCR

A Action publica a imagem a cada push em `main` (ou manualmente em **Actions → Build and deploy → Run workflow**).

O primeiro pacote publicado no GHCR nasce **privado**, mesmo com o repositório público. A VPS consegue puxar imagem privada se tiver uma credencial do GitHub cadastrada no Docker Manager.

### Opção A — Manter a imagem privada (credencial no Docker Manager)

Referência: [How to add credentials for a private registry in Docker Manager](https://www.hostinger.com/support/how-to-add-credentials-for-a-private-registry-in-docker-manager/).

1. **Verifique se a credencial já existe.** As imagens de `minhadoula-api` (`ghcr.io/rsdutra/...`) já são puxadas de pacotes privados, então provavelmente já há uma credencial do GitHub em **hPanel → VPS → Docker Manager → Credentials**. Se existir e estiver válida, ela vale para qualquer imagem `ghcr.io/rsdutra/*`.
2. Se não existir (ou o token tiver expirado):
   1. No GitHub, crie um **Personal access token (classic)** com o escopo `read:packages`. O GHCR não aceita token fine-grained.
   2. Em **hPanel → VPS → Docker Manager → Credentials**, clique em **+ Credential**.
   3. **Registry:** GitHub. **Username:** `rsdutra`. **Token:** o PAT criado acima.
   4. Salve.

Cuidados:

- Essa credencial é enviada em **todo** pull de `ghcr.io` na VPS. Se o token expirar ou for revogado, falham também os pulls de imagens públicas do GHCR (inclusive apps do Docker Catalog) — ver [Docker App Catalog deployment errors](https://www.hostinger.com/support/how-to-resolve-hostinger-vps-docker-app-catalog-deployment-errors/).
- Anote a data de expiração do PAT e atualize a credencial antes disso.

### Opção B — Tornar a imagem pública

Em https://github.com/rsdutra/mtghelper/pkgs/container/mtghelper → **Package settings → Change visibility → Public**. Nenhuma credencial é necessária na VPS.

Como o código já é público, a imagem pública não expõe nada novo (segredos entram só via env no deploy).

### Repositório privado (caso futuro)

Se o repositório voltar a ser privado, a Hostinger precisa de uma **deploy key** gerada na VPS e cadastrada em **GitHub → Settings → Deploy keys** para ler o `docker-compose.yml` do repo: [How to deploy from private GitHub repository on Hostinger Docker Manager](https://www.hostinger.com/support/how-to-deploy-from-private-github-repository-on-hostinger-docker-manager/). A action `hostinger/deploy-on-vps` envia a URL do compose no GitHub, então isso passa a ser obrigatório para o deploy automático.

---

## Passo 3 — Deploy automático do app

1. Gere uma API key em **hPanel → Perfil → API** (ou **Profile & settings → API Tokens**).
2. Cadastre no repositório:

   ```bash
   gh secret set HOSTINGER_API_KEY -R rsdutra/mtghelper
   ```

3. Faça push em `main` ou rode a Action manualmente.

O job `deploy` envia para a API da Hostinger:

- `docker-compose.yml` no commit exato do build
- `APP_IMAGE=ghcr.io/rsdutra/mtghelper:<sha do commit>`
- `AUTH_SECRET` e `POSTGRES_PASSWORD` dos secrets

Sem `HOSTINGER_API_KEY`, o job `deploy` apenas avisa e termina com sucesso — a imagem é publicada mesmo assim. Nesse caso, faça o deploy pelo MCP (`VPS_createNewProjectV1`, `project_name: mtghelper`) com o mesmo env.

A action só **inicia** o deploy. Acompanhe no hPanel → Docker Manager ou pelo MCP (`VPS_getProjectListV1`, `VPS_getProjectLogsV1`).

---

## Passo 4 — Validar

1. Aguarde 1–3 minutos o certificado Let’s Encrypt no primeiro deploy.
2. Abra https://mtghelper.srv1919186.hstgr.cloud (janela anônima ajuda).
3. Teste cadastro/login (grava no Postgres).
4. Containers `mtghelper-postgres` e `mtghelper-web-1` healthy/running.

---

## Migrations (F-014)

A cada start, o entrypoint roda `node scripts/migrate.mjs`:

1. `sql/schema.sql` (base idempotente, sempre).
2. Cada `sql/migrate_*.sql` ainda não registrada na tabela `schema_migrations`, em ordem de nome, **uma transação por arquivo**. O registro entra na mesma transação.
3. Se uma migration falha, ela é revertida inteira, o log mostra o arquivo e o container não sobe o Next.

Migration já aplicada que mudou depois (checksum diferente) só gera `AVISO` no log e **não roda de novo**. Para mudar o schema, crie uma migration nova em vez de editar uma aplicada.

Ver o estado do banco de produção (na VPS):

```bash
docker exec mtghelper-web-1 node scripts/migrate.mjs --status
```

Mostra cada arquivo como `aplicada` (com data), `pendente`, `ALTERADA` ou `sem arquivo` (registrada no banco, mas removida do repo).

Local: `npm run db:status` e `npm run db:migrate` (lêem `DATABASE_URL` do `.env`). Com o `.env` apontando para o stage, esses comandos atualizam o banco de stage.

No push para `main`, o job `migrate-stage` roda o mesmo runner contra o stage, usando o secret `STAGE_DATABASE_URL` (URL completa, sem commitar). O deploy de produção continua migrando o Postgres de produção no start do container. Os dois bancos são atualizados no mesmo merge.

### Stage pela tailnet

A porta 5434 do stage fica fechada no firewall da Hostinger; o banco só é acessível pela tailnet (`srv1919186`, `100.68.153.18`). O job `migrate-stage` entra na tailnet com `tailscale/github-action` como nó efêmero com a tag `tag:ci`, faz `tailscale ping` na VPS e só então roda a migration. O nó some da tailnet no fim do job.

Configuração (uma vez):

1. Na policy do Tailscale, declare a tag e libere só a porta do stage para ela:

   ```json
   "tagOwners": { "tag:ci": ["autogroup:admin"] },
   "hosts": { "srv1919186": "100.68.153.18" },
   "grants": [
     { "src": ["tag:ci"], "dst": ["srv1919186"], "ip": ["tcp:5434"] }
   ]
   ```

   Se a policy ainda tiver a regra padrão que libera tudo para todos (`"src": ["*"], "dst": ["*"]`), o `tag:ci` também alcança os outros dispositivos; restrinja essa regra.
2. Em **Tailscale admin → Settings → OAuth clients**, crie um client com escopo de escrita em **Auth Keys** e a tag `tag:ci`.
3. Cadastre os secrets e aponte o stage para o IP da tailnet:

   ```bash
   gh secret set TS_OAUTH_CLIENT_ID -R rsdutra/mtghelper
   gh secret set TS_OAUTH_SECRET -R rsdutra/mtghelper
   gh secret set STAGE_DATABASE_URL -R rsdutra/mtghelper   # postgres://…@100.68.153.18:5434/mtghelper_stage
   ```

Falha `write CONNECT_TIMEOUT …:5434` no job indica que o runner não está na tailnet ou que a policy não libera `tag:ci` para a porta.

---

## Checklist rápido

- [ ] Projeto `mtghelper-db` rodando (cria a rede `mtghelper-db`)
- [ ] Secrets `POSTGRES_PASSWORD`, `AUTH_SECRET`, `HOSTINGER_API_KEY` e variable `HOSTINGER_VM_ID`
- [ ] Imagem no GHCR e, se privada, credencial GitHub válida (`read:packages`) em Docker Manager → Credentials
- [ ] Firewall 80/443 sincronizado
- [ ] Traefik rodando
- [ ] Projeto `mtghelper` up
- [ ] HTTPS e login ok

---

## Troubleshooting

| Sintoma | O que checar |
|---------|----------------|
| `network mtghelper-db declared as external, but could not be found` | Projeto `mtghelper-db` não está no ar — suba o Passo 1 primeiro |
| App sobe e cai | Logs do `web` — `AUTH_SECRET` / conexão com `mtghelper-postgres` / `Falha em migrate_….sql` (migration revertida; corrija com uma migration nova ou ajuste a pendente) |
| `password authentication failed` | `POSTGRES_PASSWORD` do app diferente da usada na **primeira** criação do volume do banco |
| 404 / conexão recusada | Labels Traefik, host exato, container `web` up |
| Certificado não emite | Portas 80/443, firewall synced, logs do Traefik; espere 1–3 min |
| Pull GHCR negado (`denied` / `unauthorized`) | Credencial ausente ou PAT expirado/sem `read:packages`; ou torne o package público |
| Job `deploy` com 401 | `HOSTINGER_API_KEY` inválida ou revogada |

---

## O que não fazer

- Não commitar `.env` nem senhas.
- Não expor o Postgres de produção na internet (só `127.0.0.1:5433`). O stage (`mtghelper-stage-db`, banco `mtghelper_stage`, porta `5434`) também fica fechado no firewall: acesso só pela tailnet, para desenvolvimento remoto e para o job `migrate-stage`. A senha fica só no `.env` local e no secret.
- Não publicar porta extra do Next (deixe só Traefik em 80/443).
- Não trocar `POSTGRES_PASSWORD` só no secret: a senha é gravada no volume na primeira inicialização; para trocar, altere no Postgres (`ALTER USER`) e depois no secret.
- Não versionar `.cursor/mcp.json`.
