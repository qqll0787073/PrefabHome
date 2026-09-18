import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import test from "node:test";

const migration = readFileSync("supabase/migrations/0037_restore_transaction_write_protection.sql", "utf8");
const inventory = JSON.parse(readFileSync("audit/sprint-5c2/trigger-inventory-before.json", "utf8"));
const regression = readFileSync("supabase/tests/transaction_trigger_restoration_security.sql", "utf8");
test("0037 restores exactly the individually reviewed 17 canonical trigger attachments", () => {
  const enabled = [...migration.matchAll(/alter table public\.(\w+) enable trigger (\w+);/g)].map(m => [m[1],m[2]]);
  assert.deepEqual(enabled, inventory.map(t => [t.table_name,t.tgname]));
  assert.equal(enabled.length,17);
  assert.match(migration,/^begin;$/m); assert.match(migration,/commit;\s*$/);
  assert.doesNotMatch(migration,/disable trigger|enable trigger all|create or replace function|insert into|delete from|update public\.|grant execute/i);
  for (const marker of ["tgtype <> 31","tgqual is not null","tgconstraint <> 0","body_hash","pg_get_userbyid","has_function_privilege","lock_timeout","postcondition"]) assert.ok(migration.includes(marker),marker);
});
test("0037 fingerprints are derived from latest canonical functions, not just a live snapshot", () => {
  const files=readdirSync("supabase/migrations").filter(f=>/^00(0[1-9]|[12]\d|3[0-6])_/.test(f)).sort();
  for (const item of inventory) {
    let canonical;
    for (const file of files) {
      const sql=readFileSync("supabase/migrations/"+file,"utf8");
      const match=sql.match(new RegExp("create or replace function public\\."+item.proname+"\\(\\)[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;","i"));
      if(match)canonical=match[1];
    }
    assert.ok(canonical,item.proname);
    const live=item.function_definition.match(/AS \$function\$([\s\S]*?)\$function\$/)[1];
    assert.equal(live.replace(/\s+/g," ").trim(),canonical.replace(/\s+/g," ").trim());
    const hash=createHash("md5").update(canonical.replaceAll("\r","").trim()).digest("hex");
    assert.ok(migration.includes(hash),item.proname+" hash");
  }
});
test("0001-0036 are byte-identical to the authorized PR head", () => {
  for(const file of readdirSync("supabase/migrations").filter(f=>f<"0037_").sort()){
    const path="supabase/migrations/"+file;
    const expected=execFileSync("git",["rev-parse","e62f837c2ec86ae2a5172861a3fc141b81547c4a:"+path],{encoding:"utf8"}).trim();
    const actual=execFileSync("git",["hash-object","--path="+path,path],{encoding:"utf8"}).trim();
    assert.equal(actual,expected,path);
  }
});
test("executable coverage includes every restored guard and real lifecycle RPCs", () => {
  for(const item of inventory) assert.ok(regression.includes("('"+item.table_name+"',"),item.table_name);
  for(const marker of ["suspended","pending","buyer_id","manufacturer_id","subtotal","status","create_purchase_order_from_quote","again.id","confirm_purchase_order","request_purchase_order_revision","resubmit_purchase_order","update_contract_draft","update_buyer_signature_participant","issue_invoice","mark_shipping_readiness_ready","submit_logistics_booking_request","permission denied","fixture_id","rollback;"])assert.ok(regression.includes(marker),marker);
  assert.doesNotMatch(regression,/session_replication_role|disable trigger|commit;/i);
});
