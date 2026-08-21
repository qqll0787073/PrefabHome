import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { Client } from "pg";

const databaseUrl = process.env.PREFAB_DISPOSABLE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("PREFAB_DISPOSABLE_DATABASE_URL is required.");
}

const parsedUrl = new URL(databaseUrl);
assert.ok(
  parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost" || parsedUrl.hostname === "[::1]",
  "Disposable database host must be loopback.",
);

for (const variable of [
  "DATABASE_URL",
  "PGHOST",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_DB_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
]) {
  delete process.env[variable];
}

const migrationsDirectory = resolve("supabase/migrations");
const migrationFiles = (await readdir(migrationsDirectory))
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort();

assert.equal(migrationFiles.length, 32, "Expected exactly migrations 0001-0032.");
assert.equal(migrationFiles.at(-1), "0032_secure_manufacturer_product_management.sql");

const client = new Client({ connectionString: databaseUrl, application_name: "prefab-disposable-validation" });
const results = [];

try {
  await client.connect();
  const host = await client.query("select host(inet_server_addr()) as host, inet_server_port() as port");
  assert.ok(["127.0.0.1", "::1"].includes(host.rows[0].host), "Connected database is not loopback.");

  const bootstrap = await readFile(resolve("scripts/local-db/supabase-compat-bootstrap.sql"), "utf8");
  await client.query(bootstrap);

  for (const file of migrationFiles) {
    const sql = await readFile(resolve(migrationsDirectory, file), "utf8");
    const startedAt = performance.now();
    try {
      await client.query(sql);
      await client.query(
        "insert into supabase_migrations.schema_migrations(version, statements, name) values ($1, $2, $3)",
        [file.slice(0, 4), [sql], file.slice(5, -4)],
      );
      results.push({
        file,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        result: "passed",
        sha256: createHash("sha256").update(sql).digest("hex"),
      });
    } catch (error) {
      results.push({
        file,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        result: "failed",
        sqlState: error.code ?? null,
        position: error.position ?? null,
        routine: error.routine ?? null,
        where: error.where ?? null,
        message: String(error.message).replaceAll(databaseUrl, "[local database URL redacted]"),
      });
      throw error;
    }
  }

  const manufacturerProductRegression = await readFile(
    resolve("supabase/tests/manufacturer_product_management_security.sql"),
    "utf8",
  );
  await client.query(manufacturerProductRegression);

  const directoryPrivileges = await client.query(`
    select grantee, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public' and table_name = 'buyer_manufacturer_directory'
      and grantee in ('anon', 'authenticated')
    order by grantee, privilege_type
  `);
  assert.deepEqual(directoryPrivileges.rows, [{ grantee: "authenticated", privilege_type: "SELECT" }]);
  assert.equal((await client.query("select has_table_privilege('anon', 'public.buyer_manufacturer_directory', 'select') as allowed")).rows[0].allowed, false);
  assert.equal((await client.query("select has_table_privilege('authenticated', 'public.buyer_manufacturer_directory', 'select') as allowed")).rows[0].allowed, true);
  for (const privilege of ["insert", "update", "delete", "truncate", "references", "trigger"]) {
    assert.equal((await client.query("select has_table_privilege('authenticated', 'public.buyer_manufacturer_directory', $1) as allowed", [privilege])).rows[0].allowed, false);
  }

  console.log(JSON.stringify({
    databaseHost: host.rows[0].host,
    databasePort: host.rows[0].port,
    migrations: results,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    migrations: results,
    failure: {
      sqlState: error.code ?? null,
      position: error.position ?? null,
      routine: error.routine ?? null,
      where: error.where ?? null,
      message: error.message,
    },
  }, null, 2));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
