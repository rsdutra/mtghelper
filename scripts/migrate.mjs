// F-014 — Runner de migrations: aplica sql/schema.sql e as sql/migrate_*.sql pendentes.
// Uso: node scripts/migrate.mjs            aplica
//      node scripts/migrate.mjs --status   só lista aplicadas, pendentes e alteradas
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const SQL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "sql");
const statusOnly = process.argv.includes("--status");

if (!process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

function readSql(file) {
  return readFileSync(join(SQL_DIR, file), "utf8");
}

// O checkout no Windows usa CRLF e o container LF; o checksum ignora a diferença.
function checksum(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}

function migrationFiles() {
  return readdirSync(SQL_DIR)
    .filter((file) => file.startsWith("migrate_") && file.endsWith(".sql"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  const rows = await sql`SELECT filename, checksum, applied_at FROM schema_migrations`;
  const applied = new Map(rows.map((row) => [row.filename, row]));
  const files = migrationFiles().map((file) => ({ file, text: readSql(file) }));
  const pending = files.filter(({ file }) => !applied.has(file));
  const changed = files.filter(({ file, text }) => applied.has(file) && applied.get(file).checksum !== checksum(text));

  if (statusOnly) {
    for (const { file, text } of files) {
      const row = applied.get(file);
      if (!row) console.log(`pendente  ${file}`);
      else if (row.checksum !== checksum(text)) console.log(`ALTERADA  ${file}  (aplicada ${row.applied_at.toISOString()})`);
      else console.log(`aplicada  ${file}  (${row.applied_at.toISOString()})`);
    }
    const missing = [...applied.keys()].filter((file) => !files.some((item) => item.file === file));
    for (const file of missing) console.log(`sem arquivo  ${file}`);
    console.log(`\n${files.length - pending.length} aplicada(s), ${pending.length} pendente(s), ${changed.length} alterada(s)`);
    return;
  }

  console.log("-> schema.sql");
  await sql.unsafe(readSql("schema.sql")).simple();

  for (const { file } of changed) {
    console.warn(`AVISO: ${file} mudou depois de aplicada; não será reexecutada.`);
  }

  for (const { file, text } of pending) {
    console.log(`-> ${file}`);
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(text).simple();
        await tx`INSERT INTO schema_migrations (filename, checksum) VALUES (${file}, ${checksum(text)})`;
      });
    } catch (error) {
      console.error(`Falha em ${file} (revertida): ${error.message}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log(pending.length ? `${pending.length} migration(s) aplicada(s).` : "Nenhuma migration pendente.");
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
