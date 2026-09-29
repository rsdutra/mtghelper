# F-014 — Controle de migrations aplicadas

## Objetivo

Registrar no próprio banco quais migrations já foram aplicadas, para rodar em cada start só as pendentes, cada uma em transação, e poder consultar o estado de produção.

## Contexto

Hoje o `scripts/docker-entrypoint.sh` roda `sql/schema.sql` e **todas** as `sql/migrate_*.sql` (ordem alfabética) a cada start do container, com `psql -f`. Não há registro do que já rodou; a segurança depende de cada arquivo ser idempotente. Problemas:

- Não dá para saber o que foi aplicado em produção nem quando.
- Migrations destrutivas rodam para sempre a cada deploy.
- `psql -f` confirma comando a comando: uma falha no meio deixa a migration pela metade.
- Localmente não há comando único para migrar (no Windows o `psql` nem está no PATH).

## Escopo

- Tabela de controle no banco com arquivo, checksum e data de aplicação — US-014-01.
- Runner que aplica só as pendentes, uma transação por arquivo, e registra ao terminar — US-014-02.
- Mesmo runner no entrypoint (produção) e num comando local — US-014-03.
- Comando de status: aplicadas, pendentes e alteradas — US-014-04.
- Adoção sem quebrar os bancos existentes (produção, stage, local) — US-014-05.

## Fora de escopo

- Rollback / migrations “down”.
- Ferramenta externa (dbmate, node-pg-migrate, Flyway).
- Renomear ou renumerar as migrations existentes.

## User stories

### US-014-01 — Tabela de controle

**Como** mantenedor **quero** uma tabela com as migrations aplicadas **para** saber o estado de cada banco.

Critérios de aceite:

- [x] Tabela `schema_migrations` (`filename` PK, `checksum`, `applied_at`).
- [x] Criada pelo próprio runner se não existir.

### US-014-02 — Aplicar só as pendentes

**Como** mantenedor **quero** que cada migration rode uma vez **para** não reexecutar scripts destrutivos a cada deploy.

Critérios de aceite:

- [x] Ordem: nome do arquivo, comparação ordinal (a mesma do `sh` hoje).
- [x] Cada arquivo roda numa transação; o registro em `schema_migrations` entra na mesma transação.
- [x] Falha: rollback do arquivo, erro com o nome da migration, start interrompido (app não sobe com schema pela metade).
- [x] Migrations já registradas não rodam de novo.

### US-014-03 — Mesmo runner em produção e local

**Como** dev **quero** um comando local igual ao de produção **para** migrar meu banco sem montar a sequência na mão.

Critérios de aceite:

- [x] Entrypoint do container usa o runner antes de subir o Next.
- [x] Comando local (`npm run db:migrate`) lendo `DATABASE_URL` do `.env`, sem exibir credenciais.

### US-014-04 — Status

**Como** mantenedor **quero** ver o que está aplicado **para** conferir produção antes/depois de um deploy.

Critérios de aceite:

- [x] Comando de status lista aplicadas (com data), pendentes e alteradas depois de aplicadas (checksum diferente).

### US-014-05 — Adoção nos bancos existentes

**Como** mantenedor **quero** ligar o controle sem intervenção manual **para** não arriscar produção.

Critérios de aceite:

- [x] No primeiro start com o runner, as migrations atuais rodam uma vez (são idempotentes) e ficam registradas.
- [x] Testado no banco local e num banco novo vazio.

## Decisões (confirmadas com o usuário)

1. Runner em **Node**, com o pacote `postgres` que o app já usa: o mesmo código roda no container e no Windows (`npm run db:migrate`).
2. Checksum de migration aplicada mudou: **só avisa** no log e segue; aparece como “alterada” no status.
3. `sql/schema.sql` **continua rodando a cada start**, antes das migrations (base idempotente, sem registro).

## Testes

Sem Playwright: não há fluxo de UI. Validado com o runner real:

- Banco local já migrado pelo método antigo: status com 11 pendentes → `db:migrate` roda e registra as 11 → segunda execução “Nenhuma migration pendente”.
- Banco vazio temporário: schema completo (mesmas tabelas do local); migration de teste com erro no meio revertida inteira (tabela criada antes do erro não existe, arquivo não registrado, exit 1).
- Checksum alterado: `AVISO` no migrate, `ALTERADA` no status; registro sem arquivo aparece como `sem arquivo`.
- Layout da imagem simulado a partir do build standalone: o standalone **não** traz o pacote `postgres` (Turbopack empacota no bundle), por isso o `Dockerfile` copia `node_modules/postgres`; com a cópia, o runner roda.

## Superfície

- `scripts/docker-entrypoint.sh`, `Dockerfile`, runner em `scripts/`, `package.json` (script `db:migrate`).
- Dados: tabela `schema_migrations`.
- Docs: `docs/deploy-hostinger-vps.md`.

## Relação com outras features

- Todas as features com migrations em `sql/` (F-004, F-005, F-006, F-008, F-012, F-013).
