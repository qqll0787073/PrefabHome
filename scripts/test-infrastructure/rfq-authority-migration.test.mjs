import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { resolveAuthProfilesMigrationBaseline } from "./bootstrap-staging.mjs";

const migrationPath = "supabase/migrations/0025_restore_rfq_quote_authority.sql";
const migration = readFileSync(migrationPath, "utf8");
const rfqService = readFileSync("src/lib/rfq.ts", "utf8");

const approvedTriggers = [
  ["rfqs", "protect_rfq_write"],
  ["rfqs", "record_rfq_lifecycle_event"],
  ["rfqs", "set_rfqs_updated_at"],
  ["rfq_messages", "protect_rfq_message_insert"],
  ["rfq_messages", "record_rfq_message_event"],
  ["rfq_events", "protect_rfq_event_insert"],
  ["rfq_quotes", "protect_rfq_quote_write"],
  ["rfq_quotes", "set_rfq_quote_updated_at"],
  ["rfq_quote_items", "protect_rfq_quote_item_write"],
  ["rfq_quote_items", "after_rfq_quote_item_change"],
  ["rfq_quote_items", "set_rfq_quote_item_updated_at"],
  ["rfq_quote_decisions", "protect_rfq_quote_decision_write"],
];

test("0025 is the sole migration after the immutable 0001-0024 baseline", () => {
  const migrations = readdirSync("supabase/migrations")
    .filter((file) => /^\d{4}_.+\.sql$/.test(file))
    .sort();
  assert.equal(migrations.length, 25);
  assert.equal(migrations.at(-1), "0025_restore_rfq_quote_authority.sql");

  const baseline = resolveAuthProfilesMigrationBaseline();
  for (const migrationFile of migrations.slice(0, 24)) {
    const baselineContents = execFileSync(
      "git",
      ["show", `${baseline}:supabase/migrations/${migrationFile}`],
      { encoding: "utf8", windowsHide: true },
    ).replace(/\r\n/g, "\n");
    const currentContents = readFileSync(`supabase/migrations/${migrationFile}`, "utf8")
      .replace(/\r\n/g, "\n");
    assert.equal(currentContents, baselineContents, `${migrationFile} changed`);
  }
});

test("0025 is transactional, fail-closed, local-only SQL", () => {
  assert.match(migration, /^begin;/m);
  assert.match(migration, /Migration 0025 preflight failed:/);
  assert.match(migration, /Migration 0025 postflight failed:/);
  assert.match(migration, /commit;\s*$/);
  assert.doesNotMatch(migration, /supabase\s+(?:db|migration)|project-ref|\.supabase\.co/i);
  assert.doesNotMatch(migration, /drop\s+.+cascade|enable\s+trigger\s+(?:all|user)/i);
});

test("0025 enables only the twelve approved RFQ and Quote triggers", () => {
  const enabled = [...migration.matchAll(/alter table public\.(\w+) enable trigger (\w+);/gi)]
    .map((match) => [match[1], match[2]]);
  assert.deepEqual(enabled, approvedTriggers);
  assert.match(migration, /t\.tgenabled = 'O'/);
  assert.match(migration, /enabled_count <> 12/);
});

test("Quote revision lineage is same-RFQ, restricted, immutable, and acyclic", () => {
  assert.match(migration, /add column supersedes_quote_id uuid/);
  assert.match(migration, /foreign key \(rfq_id, supersedes_quote_id\)[\s\S]+references public\.rfq_quotes \(rfq_id, id\)[\s\S]+on delete restrict/);
  assert.match(migration, /supersedes_quote_id <> id/);
  assert.match(migration, /Quote revision lineage is immutable/);
  assert.match(migration, /with recursive ancestry/);
  assert.match(migration, /Quote revision lineage must be acyclic/);
  assert.match(migration, /rfq_quotes_one_revision_per_source_idx/);
  assert.match(migration, /rfq_quotes_one_current_submitted_per_rfq_idx/);
});

test("revision submission locks and atomically supersedes revision_requested source", () => {
  assert.match(migration, /create or replace function public\.submit_rfq_quote\(quote_uuid uuid\)/);
  assert.match(migration, /for update of r/);
  assert.match(migration, /where id = quote_uuid for update/);
  assert.match(migration, /where id = quote_record\.supersedes_quote_id for update/);
  assert.match(migration, /source_quote\.status <> 'revision_requested'/);
  assert.match(migration, /set status = 'superseded'[\s\S]+status = 'revision_requested'/);
  assert.match(migration, /set status = 'submitted', submitted_at = now\(\)/);
  assert.match(migration, /where id = quote_record\.rfq_id[\s\S]+then 'manufacturer_review' else 'revision_requested' end/);
});

test("event authority is source-aware, server-derived, and externally revoked", () => {
  assert.match(migration, /create or replace function public\.record_rfq_event\([\s\S]+security definer[\s\S]+set search_path = public/);
  assert.match(migration, /actor_uuid uuid := auth\.uid\(\)/);
  assert.match(migration, /actor_role_value text := public\.current_profile_role\(\)/);
  assert.match(migration, /rfq_events_source_event_unique/);
  assert.match(migration, /rfq_events_terminal_lifecycle_unique/);
  assert.match(migration, /on conflict \(rfq_id, event_key\).*do nothing/);
  assert.match(migration, /revoke all on function public\.record_rfq_event\(uuid,text,jsonb\) from public, anon, authenticated, service_role/);
  assert.doesNotMatch(migration, /grant execute on function public\.record_rfq_event/);
});

test("RFQ and message browser writes use narrow RPCs with derived identity", () => {
  for (const rpc of [
    "create_rfq_draft", "update_rfq_draft", "submit_rfq", "cancel_rfq",
    "delete_rfq_draft", "send_rfq_message",
  ]) {
    assert.match(migration, new RegExp(`create or replace function public\\.${rpc}\\(`));
    assert.match(rfqService, new RegExp(`\\.rpc\\(\"${rpc}\"`));
  }
  assert.match(migration, /new\.sender_profile_id := auth\.uid\(\)/);
  assert.match(migration, /new\.sender_role := 'buyer'/);
  assert.match(migration, /new\.sender_role := 'manufacturer'/);
  assert.doesNotMatch(rfqService, /from\(\"rfq_messages\"\)\s*\.insert/);
  assert.doesNotMatch(rfqService, /from\(\"rfqs\"\)\s*\.(?:insert|update|delete)/);
});

test("RLS protects Manufacturer drafts and Admin has no mutation policy", () => {
  assert.match(migration, /or \(status <> 'draft' and public\.owns_manufacturer\(manufacturer_id\)\)/);
  assert.match(migration, /or \(\s*r\.status <> 'draft'\s*and public\.owns_manufacturer\(r\.manufacturer_id\)\s*\)/);
  assert.doesNotMatch(migration, /create policy[^;]+(?:insert|update|delete)[^;]+public\.is_admin\(\)/is);
  assert.match(migration, /revoke all on table public\.rfqs from anon, authenticated/);
  assert.match(migration, /grant select on table public\.rfqs to authenticated/);
});
