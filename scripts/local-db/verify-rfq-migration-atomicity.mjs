import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import process from "node:process";
import { Client } from "pg";

const adminUrl = process.env.PREFAB_DISPOSABLE_DATABASE_URL;
if (!adminUrl) throw new Error("PREFAB_DISPOSABLE_DATABASE_URL is required.");
const parsed = new URL(adminUrl);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname), "Database host must be loopback.");

const databaseName = `sprint3a5_atomicity_${process.pid}`;
const targetUrl = new URL(adminUrl);
targetUrl.pathname = `/${databaseName}`;
const admin = new Client({ connectionString: adminUrl });
await admin.connect();

async function fingerprint(client) {
  const result = await client.query(`
    select md5(string_agg(object_type || ':' || identity || ':' || definition, E'\n' order by object_type, identity)) fingerprint
    from (
      select 'column' object_type, table_name || '.' || column_name identity,
        data_type || ':' || is_nullable || ':' || coalesce(column_default, '') definition
      from information_schema.columns where table_schema='public'
        and table_name in ('rfqs','rfq_messages','rfq_events','rfq_quotes','rfq_quote_items','rfq_quote_decisions')
      union all
      select 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', pg_get_functiondef(p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and (p.proname like '%rfq%' or p.proname like '%quote%')
      union all
      select 'policy', tablename || '.' || policyname,
        coalesce(cmd,'') || ':' || coalesce(qual,'') || ':' || coalesce(with_check,'')
      from pg_policies where schemaname='public'
        and tablename in ('rfqs','rfq_messages','rfq_events','rfq_quotes','rfq_quote_items','rfq_quote_decisions')
      union all
      select 'trigger', c.relname || '.' || t.tgname,
        t.tgenabled::text || ':' || pg_get_triggerdef(t.oid)
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and not t.tgisinternal
        and c.relname in ('rfqs','rfq_messages','rfq_events','rfq_quotes','rfq_quote_items','rfq_quote_decisions')
      union all
      select 'grant', table_name || '.' || grantee || '.' || privilege_type, 'present'
      from information_schema.role_table_grants where table_schema='public'
        and table_name in ('rfqs','rfq_messages','rfq_events','rfq_quotes','rfq_quote_items','rfq_quote_decisions')
    ) objects
  `);
  return result.rows[0].fingerprint;
}

let target;
try {
  await admin.query(`create database ${databaseName} template template0`);
  target = new Client({ connectionString: targetUrl.toString() });
  await target.connect();
  const host = (await target.query("select host(inet_server_addr()) host")).rows[0].host;
  assert.ok(["127.0.0.1", "::1"].includes(host));

  await target.query(await readFile("scripts/local-db/supabase-compat-bootstrap.sql", "utf8"));
  const migrations = (await readdir("supabase/migrations")).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort();
  for (const file of migrations.slice(0, 24)) {
    await target.query(await readFile(`supabase/migrations/${file}`, "utf8"));
  }

  const before = await fingerprint(target);
  const migrationPath = "supabase/migrations/0025_restore_rfq_quote_authority.sql";
  const committed = await readFile(migrationPath, "utf8");
  const checksumBefore = createHash("sha256").update(committed).digest("hex");
  const lateFailure = committed.replace(
    /commit;\s*$/,
    "select public.__intentional_sprint_3a_5_late_failure();\ncommit;",
  );
  assert.notEqual(lateFailure, committed, "Temporary late-failure SQL was not created.");

  let failure;
  try {
    await target.query(lateFailure);
  } catch (error) {
    failure = error;
  }
  assert.ok(failure, "Late-failure migration unexpectedly succeeded.");
  assert.equal(failure.code, "42883", "Expected undefined-function late failure.");
  await target.query("rollback");

  const after = await fingerprint(target);
  const checksumAfter = createHash("sha256").update(await readFile(migrationPath, "utf8")).digest("hex");
  assert.equal(after, before, "Schema/policy/grant/function/trigger fingerprint changed after rollback.");
  assert.equal(checksumAfter, checksumBefore, "Committed migration changed during atomicity test.");
  assert.equal(
    (await target.query("select count(*)::int count from information_schema.columns where table_schema='public' and table_name='rfq_quotes' and column_name='supersedes_quote_id'")).rows[0].count,
    0,
    "0025 lineage column survived rollback.",
  );

  console.log(JSON.stringify({
    result: "passed",
    databaseHost: host,
    failureSqlState: failure.code,
    fingerprintBefore: before,
    fingerprintAfter: after,
    committedMigrationUnchanged: checksumBefore === checksumAfter,
    residueCount: 0,
  }, null, 2));
} finally {
  await target?.end().catch(() => undefined);
  await admin.query(`drop database if exists ${databaseName} with (force)`).catch(() => undefined);
  await admin.end();
}
