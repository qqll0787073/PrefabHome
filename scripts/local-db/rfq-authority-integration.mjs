import assert from "node:assert/strict";
import process from "node:process";
import { Client } from "pg";

const databaseUrl = process.env.PREFAB_DISPOSABLE_DATABASE_URL;
if (!databaseUrl) throw new Error("PREFAB_DISPOSABLE_DATABASE_URL is required.");

const parsedUrl = new URL(databaseUrl);
assert.ok(
  ["127.0.0.1", "localhost", "[::1]"].includes(parsedUrl.hostname),
  "Disposable database host must be loopback.",
);

const ids = {
  buyerA: "10000000-0000-4000-8000-000000000001",
  buyerB: "10000000-0000-4000-8000-000000000002",
  manufacturerAUser: "10000000-0000-4000-8000-000000000101",
  manufacturerBUser: "10000000-0000-4000-8000-000000000102",
  admin: "10000000-0000-4000-8000-000000000201",
  manufacturerA: "20000000-0000-4000-8000-000000000101",
  manufacturerB: "20000000-0000-4000-8000-000000000102",
  product: "30000000-0000-4000-8000-000000000001",
};

const allowedRoles = new Set(["anon", "authenticated"]);
let assertionCount = 0;
const sections = new Map();
const concurrency = [];
const performanceResults = {};

function check(condition, name, section = "integration") {
  assert.ok(condition, name);
  assertionCount += 1;
  sections.set(section, (sections.get(section) ?? 0) + 1);
}

function createClient() {
  return new Client({ connectionString: databaseUrl, application_name: "prefab-rfq-integration" });
}

async function withRole(role, userId, callback) {
  assert.ok(allowedRoles.has(role), `Unsupported role ${role}`);
  const client = createClient();
  await client.connect();
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    await client.query(
      "select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)",
      [userId ?? "", role],
    );
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function asAuthenticated(userId, callback) {
  return withRole("authenticated", userId, callback);
}

async function expectDenied(action, name, section = "authority") {
  let error;
  try {
    await action();
  } catch (caught) {
    error = caught;
  }
  check(Boolean(error), name, section);
  return error;
}

async function scalar(client, text, values = []) {
  const result = await client.query(text, values);
  return Object.values(result.rows[0] ?? {})[0];
}

async function setupFixtures(admin) {
  await admin.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
      ($1, 'buyer-a@local.invalid', '{"role":"buyer","full_name":"Buyer A"}'),
      ($2, 'buyer-b@local.invalid', '{"role":"buyer","full_name":"Buyer B"}'),
      ($3, 'manufacturer-a@local.invalid', '{"role":"manufacturer","full_name":"Manufacturer A"}'),
      ($4, 'manufacturer-b@local.invalid', '{"role":"manufacturer","full_name":"Manufacturer B"}'),
      ($5, 'admin-a@local.invalid', '{"role":"buyer","full_name":"Admin A"}')`,
    [ids.buyerA, ids.buyerB, ids.manufacturerAUser, ids.manufacturerBUser, ids.admin],
  );
  await admin.query("update public.profiles set role = 'admin' where id = $1", [ids.admin]);

  await asAuthenticated(ids.manufacturerAUser, (client) => client.query(
    `insert into public.manufacturers
      (id, owner_id, company_name, company_legal_name, company_display_name, country, application_status)
     values ($1, $2, 'Local Manufacturer A', 'Local Manufacturer A LLC', 'Local Manufacturer A', 'US', 'draft')`,
    [ids.manufacturerA, ids.manufacturerAUser],
  ));
  await asAuthenticated(ids.manufacturerBUser, (client) => client.query(
    `insert into public.manufacturers
      (id, owner_id, company_name, company_legal_name, company_display_name, country, application_status)
     values ($1, $2, 'Local Manufacturer B', 'Local Manufacturer B LLC', 'Local Manufacturer B', 'US', 'draft')`,
    [ids.manufacturerB, ids.manufacturerBUser],
  ));
  await asAuthenticated(ids.admin, (client) => client.query(
    "update public.manufacturers set application_status = 'approved', verification_status = 'approved' where id in ($1, $2)",
    [ids.manufacturerA, ids.manufacturerB],
  ));

  await asAuthenticated(ids.manufacturerAUser, (client) => client.query(
    `insert into public.products
      (id, manufacturer_id, name, model_name, slug, category, short_description, status, currency)
     values ($1, $2, 'Disposable RFQ Home', 'Disposable RFQ Home', 'disposable-rfq-home',
       'modular-home', 'Local-only integration fixture', 'submitted', 'USD')`,
    [ids.product, ids.manufacturerA],
  ));
  await asAuthenticated(ids.admin, (client) => client.query(
    "update public.products set status = 'published' where id = $1",
    [ids.product],
  ));

  check(await scalar(admin, "select count(*)::int from public.profiles") === 5, "five local identities created", "fixtures");
  check(await scalar(admin, "select count(*)::int from public.manufacturers where application_status='approved'") === 2, "two approved local manufacturers", "fixtures");
  check(await scalar(admin, "select count(*)::int from public.products where status='published'") === 1, "published local product created", "fixtures");
}

async function createDraft(client, message = "Local RFQ draft") {
  const result = await client.query(
    "select * from public.create_rfq_draft($1,$2,$3,$4,$5,$6,$7,$8)",
    [ids.product, 2, "USD", "US", "FOB", "New York", "2030-05-20", message],
  );
  return result.rows[0];
}

async function submitDraft(client, rfqId, quantity = 3) {
  const result = await client.query(
    "select * from public.submit_rfq($1,$2,$3,$4,$5,$6,$7,$8)",
    [rfqId, quantity, "USD", "US", "FOB", "New York", "2030-05-20", "Submitted local RFQ"],
  );
  return result.rows[0];
}

async function createSubmittedRfq() {
  return asAuthenticated(ids.buyerA, async (client) => {
    const draft = await createDraft(client, `Scenario ${crypto.randomUUID()}`);
    return submitDraft(client, draft.id, 1);
  });
}

async function createQuoteWithItem(rfqId) {
  return asAuthenticated(ids.manufacturerAUser, async (client) => {
    const quote = (await client.query("select * from public.create_rfq_quote_draft($1)", [rfqId])).rows[0];
    await client.query(
      `insert into public.rfq_quote_items
        (quote_id,line_order,item_type,description,quantity,unit,unit_price)
       values ($1,1,'product','Prefab home',1,'unit',125000)`,
      [quote.id],
    );
    return quote;
  });
}

async function submitQuote(quoteId) {
  return asAuthenticated(ids.manufacturerAUser, async (client) => (
    await client.query("select * from public.submit_rfq_quote($1)", [quoteId])
  ).rows[0]);
}

async function runMainLifecycle(admin) {
  const draft = await asAuthenticated(ids.buyerA, async (client) => {
    const created = await createDraft(client);
    check(created.buyer_id === ids.buyerA, "draft Buyer is database derived", "rfq");
    check(created.status === "draft", "RFQ starts as draft", "rfq");
    const updated = (await client.query(
      "select * from public.update_rfq_draft($1,$2,$3,$4,$5,$6,$7,$8)",
      [created.id, 4, "USD", "CA", "CIF", "Vancouver", "2030-06-01", "Edited local RFQ"],
    )).rows[0];
    check(updated.id === created.id, "draft update preserves RFQ UUID", "rfq");
    check(Number(updated.requested_quantity) === 4, "draft update persists authoritative values", "rfq");
    return updated;
  });

  check(await asAuthenticated(ids.buyerB, (client) => scalar(client, "select count(*)::int from public.rfqs where id=$1", [draft.id])) === 0, "Buyer B cannot see Buyer A draft");
  check(await asAuthenticated(ids.manufacturerAUser, (client) => scalar(client, "select count(*)::int from public.rfqs where id=$1", [draft.id])) === 0, "assigned Manufacturer cannot see Buyer draft");
  check(await asAuthenticated(ids.manufacturerBUser, (client) => scalar(client, "select count(*)::int from public.rfqs where id=$1", [draft.id])) === 0, "unrelated Manufacturer cannot see Buyer draft");
  check(await asAuthenticated(ids.admin, (client) => scalar(client, "select count(*)::int from public.rfqs where id=$1", [draft.id])) === 1, "Admin can read Buyer draft");

  await expectDenied(
    () => withRole("anon", null, (client) => client.query("select * from public.rfqs")),
    "Anonymous RFQ read denied",
  );
  await expectDenied(
    () => asAuthenticated(ids.buyerA, (client) => client.query("update public.rfqs set buyer_message='bypass' where id=$1", [draft.id])),
    "Buyer direct RFQ update denied",
  );
  await expectDenied(
    () => asAuthenticated(ids.buyerA, (client) => client.query(
      `insert into public.rfqs
       (buyer_id,manufacturer_id,product_id,requested_quantity,requested_currency,destination_country)
       values($1,$2,$3,1,'USD','US')`,
      [ids.buyerA, ids.manufacturerA, ids.product],
    )),
    "Buyer direct RFQ insert denied",
  );
  await expectDenied(
    () => asAuthenticated(ids.buyerA, (client) => client.query("delete from public.rfqs where id=$1", [draft.id])),
    "Buyer direct RFQ delete denied",
  );
  await expectDenied(
    () => asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.send_rfq_message($1,'draft bypass',null)", [draft.id])),
    "Manufacturer cannot send while RFQ is draft",
  );
  await expectDenied(
    () => asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.create_rfq_quote_draft($1)", [draft.id])),
    "Manufacturer cannot create Quote for Buyer draft",
  );
  await expectDenied(
    () => asAuthenticated(ids.admin, (client) => client.query(
      "select * from public.create_rfq_draft($1,1,'USD','US',null,null,null,null)", [ids.product],
    )),
    "Admin participant RFQ RPC denied",
  );
  await expectDenied(
    () => asAuthenticated(ids.buyerA, (client) => client.query(
      "select public.record_rfq_event($1,'submitted','{}'::jsonb)", [draft.id],
    )),
    "Buyer direct event dispatcher denied",
  );
  await expectDenied(
    () => asAuthenticated(ids.buyerA, (client) => client.query(
      "insert into public.rfq_events(rfq_id,event_type,metadata) values($1,'submitted','{}'::jsonb)", [draft.id],
    )),
    "Buyer direct Event insert denied",
  );

  const submitted = await asAuthenticated(ids.buyerA, (client) => submitDraft(client, draft.id, 5));
  check(submitted.id === draft.id, "saved draft submission preserves RFQ UUID", "rfq");
  check(submitted.status === "submitted", "saved draft transitions to submitted", "rfq");
  check(await scalar(admin, "select count(*)::int from public.rfqs where buyer_id=$1 and product_id=$2", [ids.buyerA, ids.product]) === 1, "submitted draft remains exactly one authoritative row", "rfq");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='draft_created'", [draft.id]) === 1, "draft event created once", "events");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='submitted'", [draft.id]) === 1, "submitted event created once", "events");
  check(await asAuthenticated(ids.manufacturerAUser, (client) => scalar(client, "select count(*)::int from public.rfqs where id=$1", [draft.id])) === 1, "assigned Manufacturer sees submitted RFQ");
  check(await asAuthenticated(ids.manufacturerBUser, (client) => scalar(client, "select count(*)::int from public.rfqs where id=$1", [draft.id])) === 0, "other Manufacturer cannot see submitted RFQ");
  check(await asAuthenticated(ids.buyerB, (client) => scalar(client, "select count(*)::int from public.rfqs where id=$1", [draft.id])) === 0, "Buyer B cannot see Buyer A submitted RFQ");
  await expectDenied(
    () => asAuthenticated(ids.buyerA, (client) => client.query(
      "select * from public.update_rfq_draft($1,1,'USD','US',null,null,null,null)", [draft.id],
    )),
    "submitted RFQ cannot be edited as draft",
  );
  await expectDenied(
    () => asAuthenticated(ids.buyerA, (client) => client.query("select public.delete_rfq_draft($1)", [draft.id])),
    "submitted RFQ cannot be deleted as draft",
  );

  await asAuthenticated(ids.manufacturerAUser, (client) => client.query("select public.record_rfq_opened($1)", [draft.id]));
  check(await scalar(admin, "select status from public.rfqs where id=$1", [draft.id]) === "manufacturer_review", "Manufacturer open transitions to review", "rfq");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='manufacturer_opened'", [draft.id]) === 1, "Manufacturer opened event deduplicated", "events");

  await asAuthenticated(ids.buyerA, (client) => client.query("select * from public.send_rfq_message($1,$2,null)", [draft.id, " Buyer message one "]));
  await asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.send_rfq_message($1,$2,null)", [draft.id, " Manufacturer reply one "]));
  await asAuthenticated(ids.buyerA, (client) => client.query("select * from public.send_rfq_message($1,$2,null)", [draft.id, "Buyer message two"]));
  await asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.send_rfq_message($1,$2,null)", [draft.id, "Manufacturer reply two"]));
  const messages = (await admin.query("select sender_profile_id,sender_role,message from public.rfq_messages where rfq_id=$1 order by created_at,id", [draft.id])).rows;
  check(messages.length === 4, "four participant Messages persist", "messages");
  check(messages[0].sender_profile_id === ids.buyerA && messages[0].sender_role === "buyer", "Buyer Message identity and role derived", "messages");
  check(messages[1].sender_profile_id === ids.manufacturerAUser && messages[1].sender_role === "manufacturer", "Manufacturer Message identity and role derived", "messages");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='manufacturer_replied'", [draft.id]) === 2, "Manufacturer Message events are source unique", "events");
  await expectDenied(
    () => asAuthenticated(ids.manufacturerBUser, (client) => client.query("select * from public.send_rfq_message($1,'forged',null)", [draft.id])),
    "unrelated Manufacturer cannot send Message",
  );
  await expectDenied(
    () => asAuthenticated(ids.admin, (client) => client.query("select * from public.send_rfq_message($1,'admin',null)", [draft.id])),
    "Admin cannot send participant Message",
  );
  await expectDenied(
    () => asAuthenticated(ids.buyerA, (client) => client.query("insert into public.rfq_messages(rfq_id,message) values($1,'direct')", [draft.id])),
    "direct Message insert denied",
  );

  const quote = await asAuthenticated(ids.manufacturerAUser, async (client) => {
    const created = (await client.query("select * from public.create_rfq_quote_draft($1)", [draft.id])).rows[0];
    const repeated = (await client.query("select * from public.create_rfq_quote_draft($1)", [draft.id])).rows[0];
    check(created.id === repeated.id, "initial Quote draft creation is idempotent", "quotes");
    await client.query(
      `update public.rfq_quotes set currency='CAD',incoterm='CIF',origin_port='Shanghai',
       production_lead_days=45,shipping_lead_days=20,valid_until='2030-07-01',manufacturer_note='Local note'
       where id=$1`,
      [created.id],
    );
    await client.query(
      `insert into public.rfq_quote_items
        (quote_id,line_order,item_type,description,quantity,unit,unit_price) values
        ($1,1,'product','Home',2,'unit',100),($1,2,'freight','Freight',1,'shipment',50)`,
      [created.id],
    );
    const subtotal = await scalar(client, "select subtotal from public.rfq_quotes where id=$1", [created.id]);
    check(Number(subtotal) === 250, "Quote subtotal is database derived", "quotes");
    return created;
  });

  const emptyRfq = await createSubmittedRfq();
  const emptyQuote = await asAuthenticated(ids.manufacturerAUser, (client) => client.query(
    "select * from public.create_rfq_quote_draft($1)", [emptyRfq.id],
  ).then((result) => result.rows[0]));
  await expectDenied(() => submitQuote(emptyQuote.id), "empty Quote submission denied", "quotes");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='quote_created'", [emptyRfq.id]) === 0, "empty Quote creates no submission event", "events");
  await asAuthenticated(ids.manufacturerAUser, (client) => client.query("select public.delete_rfq_quote_draft($1)", [emptyQuote.id]));

  const firstSubmission = await submitQuote(quote.id);
  check(firstSubmission.status === "submitted", "initial Quote submitted", "quotes");
  const retry = await submitQuote(quote.id);
  check(retry.id === quote.id && retry.status === "submitted", "initial Quote retry returns authoritative Quote", "retry");
  check(await scalar(admin, "select count(*)::int from public.rfq_quotes where rfq_id=$1", [draft.id]) === 1, "Quote retry creates no second Quote", "retry");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='quote_created' and source_id=$2", [draft.id, quote.id]) === 1, "Quote retry creates no duplicate event", "retry");
  check(await asAuthenticated(ids.buyerA, (client) => scalar(client, "select count(*)::int from public.rfq_quotes where id=$1", [quote.id])) === 1, "Buyer can read submitted Quote", "quotes");
  check(await asAuthenticated(ids.manufacturerBUser, (client) => scalar(client, "select count(*)::int from public.rfq_quotes where id=$1", [quote.id])) === 0, "unrelated Manufacturer cannot read Quote", "quotes");

  await asAuthenticated(ids.buyerA, (client) => client.query("select public.record_rfq_quote_opened($1)", [quote.id]));
  check(await scalar(admin, "select status from public.rfqs where id=$1", [draft.id]) === "buyer_review", "Buyer opens current Quote", "quotes");
  await asAuthenticated(ids.buyerA, (client) => client.query("select * from public.request_rfq_quote_revision($1,$2)", [quote.id, "Please revise freight"]));
  check(await scalar(admin, "select status from public.rfq_quotes where id=$1", [quote.id]) === "revision_requested", "source Quote enters revision requested", "revision");

  const revisionResults = await Promise.all([
    asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.create_rfq_quote_revision($1)", [quote.id]).then((r) => r.rows[0])),
    asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.create_rfq_quote_revision($1)", [quote.id]).then((r) => r.rows[0])),
  ]);
  check(revisionResults[0].id === revisionResults[1].id, "concurrent revision creation resolves to one draft", "concurrency");
  const revision = revisionResults[0];
  check(revision.supersedes_quote_id === quote.id && revision.version === 2, "revision lineage and version are database derived", "revision");
  check(await scalar(admin, "select count(*)::int from public.rfq_quotes where supersedes_quote_id=$1", [quote.id]) === 1, "one revision per source enforced", "revision");

  await asAuthenticated(ids.manufacturerAUser, (client) => client.query("update public.rfq_quote_items set unit_price=110 where quote_id=$1 and line_order=1", [revision.id]));
  const revisionSubmission = await submitQuote(revision.id);
  check(revisionSubmission.status === "submitted", "revision Quote submitted", "revision");
  check(await scalar(admin, "select status from public.rfq_quotes where id=$1", [quote.id]) === "superseded", "source Quote superseded atomically", "revision");
  check(await scalar(admin, "select status from public.rfqs where id=$1", [draft.id]) === "quoted", "RFQ returns to quoted after revision", "revision");
  const revisionRetry = await submitQuote(revision.id);
  check(revisionRetry.id === revision.id, "revision submission retry returns authoritative Quote", "retry");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='quote_created'", [draft.id]) === 2, "one source-aware event per submitted Quote version", "events");

  await expectDenied(
    () => asAuthenticated(ids.manufacturerBUser, (client) => client.query("select * from public.submit_rfq_quote($1)", [revision.id])),
    "other Manufacturer cannot retry or submit Quote",
  );
  await expectDenied(
    () => asAuthenticated(ids.admin, (client) => client.query("select * from public.submit_rfq_quote($1)", [revision.id])),
    "Admin cannot submit participant Quote",
  );
  const adminUpdate = await asAuthenticated(ids.admin, (client) => client.query("update public.rfq_quotes set manufacturer_note='forged' where id=$1", [revision.id]));
  check(adminUpdate.rowCount === 0, "Admin direct Quote update matches no authorized row", "authority");

  await asAuthenticated(ids.buyerA, (client) => client.query("select public.record_rfq_quote_opened($1)", [revision.id]));
  await asAuthenticated(ids.buyerA, (client) => client.query("select * from public.accept_rfq_quote($1,$2)", [revision.id, "Accepted locally"]));
  check(await scalar(admin, "select status from public.rfqs where id=$1", [draft.id]) === "accepted", "Buyer decision advances RFQ", "decision");
  check(await scalar(admin, "select count(*)::int from public.rfq_quote_decisions where quote_id=$1", [revision.id]) === 1, "Buyer decision recorded once", "decision");
  const historicalRetry = await submitQuote(revision.id);
  check(historicalRetry.status === "accepted", "retry recognizes an already submitted Quote after downstream decision", "retry");

  await expectDenied(
    () => admin.query("select public.assert_rfq_quote_lineage($1,$2,$3)", [quote.id, draft.id, quote.id]),
    "self-referencing Quote lineage rejected",
    "revision",
  );
  await expectDenied(
    () => admin.query("select public.assert_rfq_quote_lineage($1,$2,$3)", [crypto.randomUUID(), crypto.randomUUID(), quote.id]),
    "cross-RFQ Quote lineage rejected",
    "revision",
  );
  await expectDenied(
    () => admin.query("select public.assert_rfq_quote_lineage($1,$2,$3)", [quote.id, draft.id, revision.id]),
    "Quote lineage cycle rejected",
    "revision",
  );
  const sourceMutation = await asAuthenticated(ids.manufacturerAUser, (client) => client.query(
    "update public.rfq_quotes set supersedes_quote_id=$1 where id=$2", [revision.id, quote.id],
  ));
  check(sourceMutation.rowCount === 0, "submitted lineage is immutable to Manufacturer", "revision");
  await expectDenied(async () => {
    const client = createClient();
    await client.connect();
    try {
      await client.query("begin");
      await client.query("select set_config('app.quote_trusted_write','on',true)");
      await client.query("delete from public.rfq_quotes where id=$1", [quote.id]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      await client.end();
    }
  }, "referenced source Quote deletion rejected", "revision");

  const draftToDelete = await asAuthenticated(ids.buyerA, createDraft);
  await asAuthenticated(ids.buyerA, (client) => client.query("select public.delete_rfq_draft($1)", [draftToDelete.id]));
  check(await scalar(admin, "select count(*)::int from public.rfqs where id=$1", [draftToDelete.id]) === 0, "eligible draft deletion succeeds", "rfq");
  const draftToCancel = await asAuthenticated(ids.buyerA, createDraft);
  await asAuthenticated(ids.buyerA, (client) => client.query("select * from public.cancel_rfq($1)", [draftToCancel.id]));
  check(await scalar(admin, "select status from public.rfqs where id=$1", [draftToCancel.id]) === "cancelled", "draft cancellation succeeds", "rfq");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='cancelled'", [draftToCancel.id]) === 1, "draft cancellation event created once", "events");
  await expectDenied(
    () => asAuthenticated(ids.buyerA, (client) => client.query("select * from public.cancel_rfq($1)", [draftToCancel.id])),
    "repeated cancellation denied",
    "rfq",
  );
  const submittedToCancel = await createSubmittedRfq();
  await asAuthenticated(ids.buyerA, (client) => client.query("select * from public.cancel_rfq($1)", [submittedToCancel.id]));
  check(await scalar(admin, "select status from public.rfqs where id=$1", [submittedToCancel.id]) === "cancelled", "submitted cancellation succeeds", "rfq");

  return { rfqId: draft.id, quoteId: quote.id, revisionId: revision.id };
}

async function runConcurrency(admin) {
  const rfqA = await createSubmittedRfq();
  const quoteA = await createQuoteWithItem(rfqA.id);
  const startedA = performance.now();
  const simultaneous = await Promise.allSettled([submitQuote(quoteA.id), submitQuote(quoteA.id)]);
  concurrency.push({ name: "same Quote submit", durationMs: performance.now() - startedA, outcomes: simultaneous.map((r) => r.status) });
  check(simultaneous.every((result) => result.status === "fulfilled"), "simultaneous same-Quote submits resolve idempotently", "concurrency");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='quote_created'", [rfqA.id]) === 1, "simultaneous submit emits one event", "concurrency");

  await asAuthenticated(ids.buyerA, (client) => client.query("select * from public.request_rfq_quote_revision($1,'Concurrent revision')", [quoteA.id]));
  const revisions = await Promise.all([
    asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.create_rfq_quote_revision($1)", [quoteA.id]).then((r) => r.rows[0])),
    asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.create_rfq_quote_revision($1)", [quoteA.id]).then((r) => r.rows[0])),
  ]);
  check(revisions[0].id === revisions[1].id, "two revision creators receive one authoritative revision", "concurrency");

  const startedC = performance.now();
  const overlap = await Promise.allSettled([
    submitQuote(revisions[0].id),
    asAuthenticated(ids.buyerA, (client) => client.query("select * from public.accept_rfq_quote($1,'late accept')", [quoteA.id])),
  ]);
  concurrency.push({ name: "decision versus revision submit", durationMs: performance.now() - startedC, outcomes: overlap.map((r) => r.status) });
  check(overlap.filter((result) => result.status === "fulfilled").length === 1, "decision/revision overlap has one winner", "concurrency");
  check(await scalar(admin, "select count(*)::int from public.rfq_quotes where rfq_id=$1 and status='submitted'", [rfqA.id]) <= 1, "decision/revision overlap keeps one current Quote", "concurrency");

  const rfqD = await createSubmittedRfq();
  const messages = await Promise.all([
    asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.send_rfq_message($1,'Concurrent one',null)", [rfqD.id]).then((r) => r.rows[0])),
    asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.send_rfq_message($1,'Concurrent two',null)", [rfqD.id]).then((r) => r.rows[0])),
  ]);
  check(messages[0].id !== messages[1].id, "concurrent Messages remain distinct", "concurrency");
  check(await scalar(admin, "select count(*)::int from public.rfq_events where rfq_id=$1 and event_type='manufacturer_replied'", [rfqD.id]) === 2, "concurrent Messages create one event each", "concurrency");

  const rfqE = await createSubmittedRfq();
  const startedE = performance.now();
  const cancelSubmit = await Promise.allSettled([
    asAuthenticated(ids.buyerA, (client) => client.query("select * from public.cancel_rfq($1)", [rfqE.id])),
    asAuthenticated(ids.manufacturerAUser, (client) => client.query("select * from public.create_rfq_quote_draft($1)", [rfqE.id])),
  ]);
  concurrency.push({ name: "RFQ cancel versus Quote draft", durationMs: performance.now() - startedE, outcomes: cancelSubmit.map((r) => r.status) });
  check(cancelSubmit.filter((result) => result.status === "fulfilled").length === 1, "RFQ cancel/Quote race has one winner", "concurrency");
  const finalE = (await admin.query("select status from public.rfqs where id=$1", [rfqE.id])).rows[0].status;
  check(["cancelled", "manufacturer_review"].includes(finalE), "RFQ cancel/Quote race leaves valid state", "concurrency");

  const rfqF = await createSubmittedRfq();
  const quoteF = await createQuoteWithItem(rfqF.id);
  const startedF = performance.now();
  const cancelVersusSubmit = await Promise.allSettled([
    asAuthenticated(ids.buyerA, (client) => client.query("select * from public.cancel_rfq($1)", [rfqF.id])),
    submitQuote(quoteF.id),
  ]);
  concurrency.push({ name: "RFQ cancellation versus Quote submission", durationMs: performance.now() - startedF, outcomes: cancelVersusSubmit.map((result) => result.status) });
  check(cancelVersusSubmit[0].status === "rejected" && cancelVersusSubmit[1].status === "fulfilled", "Quote submission wins after Manufacturer review and cancellation is denied", "concurrency");
  check(await scalar(admin, "select status from public.rfqs where id=$1", [rfqF.id]) === "quoted", "cancellation/Quote submission race leaves quoted RFQ", "concurrency");
}

async function runSchemaAndTriggerInventory(admin) {
  const tables = ["rfqs", "rfq_messages", "rfq_events", "rfq_quotes", "rfq_quote_items", "rfq_quote_decisions"];
  const rls = (await admin.query(
    `select c.relname,c.relrowsecurity,c.relforcerowsecurity,r.rolname owner
     from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner
     where n.nspname='public' and c.relname=any($1) order by c.relname`,
    [tables],
  )).rows;
  check(rls.length === 6 && rls.every((row) => row.relrowsecurity), "RLS enabled on all six RFQ domain tables", "schema");
  check(rls.every((row) => !row.relforcerowsecurity && row.owner === "postgres"), "RFQ table ownership and FORCE RLS match design", "schema");

  const expectedTriggers = [
    ["rfqs", "protect_rfq_write"], ["rfqs", "record_rfq_lifecycle_event"], ["rfqs", "set_rfqs_updated_at"],
    ["rfq_messages", "protect_rfq_message_insert"], ["rfq_messages", "record_rfq_message_event"],
    ["rfq_events", "protect_rfq_event_insert"], ["rfq_quotes", "protect_rfq_quote_write"],
    ["rfq_quotes", "set_rfq_quote_updated_at"], ["rfq_quote_items", "protect_rfq_quote_item_write"],
    ["rfq_quote_items", "after_rfq_quote_item_change"], ["rfq_quote_items", "set_rfq_quote_item_updated_at"],
    ["rfq_quote_decisions", "protect_rfq_quote_decision_write"],
  ];
  const triggers = (await admin.query(
    `select c.relname table_name,t.tgname,t.tgenabled,p.proname
     from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
     join pg_proc p on p.oid=t.tgfoid where n.nspname='public' and not t.tgisinternal
     and c.relname=any($1)`, [tables],
  )).rows;
  for (const [table, trigger] of expectedTriggers) {
    check(triggers.some((row) => row.table_name === table && row.tgname === trigger && row.tgenabled === "O"), `${table}.${trigger} enabled`, "triggers");
  }
  check(expectedTriggers.length === 12, "exactly twelve scoped trigger expectations", "triggers");

  const reviewedFunctionNames = [
    "rfq_write_context", "is_trusted_rfq_message_write", "is_trusted_rfq_event_write",
    "assert_rfq_values", "can_access_rfq", "can_access_rfq_quote", "can_manage_rfq_quote_draft",
    "protect_rfq_write", "record_rfq_event", "insert_trusted_rfq_event", "protect_rfq_event_insert",
    "record_rfq_lifecycle_event", "record_rfq_message_event", "protect_rfq_message_insert",
    "create_rfq_draft", "update_rfq_draft", "submit_rfq", "cancel_rfq", "delete_rfq_draft",
    "send_rfq_message", "record_rfq_opened", "protect_rfq_quote_write", "assert_rfq_quote_lineage",
    "create_rfq_quote_draft", "create_rfq_quote_revision", "delete_rfq_quote_draft", "submit_rfq_quote",
    "record_rfq_quote_opened", "decide_rfq_quote", "accept_rfq_quote", "reject_rfq_quote",
    "request_rfq_quote_revision", "is_trusted_quote_write", "is_trusted_quote_decision_write",
    "is_trusted_rfq_opened_write", "recalculate_rfq_quote_subtotal", "protect_rfq_quote_item_write",
    "after_rfq_quote_item_change", "protect_rfq_quote_decision_write", "is_valid_rfq_transition",
    "build_rfq_product_snapshot", "set_rfq_updated_at", "set_rfq_quote_updated_at",
    "set_rfq_quote_item_updated_at",
  ];
  const functions = (await admin.query(
    `select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,
      pg_get_function_result(p.oid) result,r.rolname owner,p.prosecdef,p.provolatile,p.proconfig
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
     where n.nspname='public' and p.proname=any($1) order by p.proname,arguments`,
    [reviewedFunctionNames],
  )).rows;
  check(functions.some((row) => row.proname === "record_rfq_event" && row.arguments === "rfq_uuid uuid, event_name text, event_metadata jsonb"), "event dispatcher signature present", "functions");
  check(functions.filter((row) => row.prosecdef).every((row) => row.proconfig?.some((setting) => setting === "search_path=public, pg_temp")), "reviewed SECURITY DEFINER search paths hardened", "functions");
  return { rls, functions, triggers };
}

async function runPerformance(admin) {
  const generationStarted = performance.now();
  const rfqIds = await asAuthenticated(ids.buyerA, async (client) => {
    const created = [];
    for (let index = 0; index < 100; index += 1) {
      const draft = await createDraft(client, `Performance RFQ ${index}`);
      created.push((await submitDraft(client, draft.id, 1)).id);
    }
    return created;
  });
  const quoteIds = await asAuthenticated(ids.manufacturerAUser, async (client) => {
    const created = [];
    for (const [index, rfqId] of rfqIds.entries()) {
      const quote = (await client.query("select * from public.create_rfq_quote_draft($1)", [rfqId])).rows[0];
      await client.query(
        "insert into public.rfq_quote_items(quote_id,line_order,item_type,description,quantity,unit,unit_price) values($1,1,'product',$2,1,'unit',100000)",
        [quote.id, `Performance item ${index}`],
      );
      created.push((await client.query("select * from public.submit_rfq_quote($1)", [quote.id])).rows[0].id);
    }
    return created;
  });
  await asAuthenticated(ids.buyerA, async (client) => {
    for (const rfqId of rfqIds) {
      for (let index = 0; index < 5; index += 1) {
        await client.query("select * from public.send_rfq_message($1,$2,null)", [rfqId, `Buyer performance message ${index}`]);
      }
    }
    for (let index = 0; index < 50; index += 1) {
      await client.query("select * from public.request_rfq_quote_revision($1,$2)", [quoteIds[index], `Performance revision ${index}`]);
    }
  });
  await asAuthenticated(ids.manufacturerAUser, async (client) => {
    for (const rfqId of rfqIds) {
      for (let index = 0; index < 5; index += 1) {
        await client.query("select * from public.send_rfq_message($1,$2,null)", [rfqId, `Manufacturer performance message ${index}`]);
      }
    }
    for (let index = 0; index < 50; index += 1) {
      const revision = (await client.query("select * from public.create_rfq_quote_revision($1)", [quoteIds[index]])).rows[0];
      await client.query("select * from public.submit_rfq_quote($1)", [revision.id]);
    }
  });
  performanceResults.generationMs = Math.round((performance.now() - generationStarted) * 100) / 100;
  performanceResults.generated = { rfqs: 100, messages: 1000, quotes: 100, revisions: 50 };

  const queries = {
    rfqList: "select * from public.rfqs where buyer_id=$1 order by created_at desc limit 25",
    rfqDetail: "select * from public.rfqs where id=$1",
    messages: "select * from public.rfq_messages where rfq_id=$1 order by created_at",
    quoteHistory: "select * from public.rfq_quotes where rfq_id=$1 order by version desc",
  };
  performanceResults.queries = {};
  for (const [name, query] of Object.entries(queries)) {
    const values = name === "rfqList" ? [ids.buyerA] : [rfqIds[0]];
    const started = performance.now();
    const explain = await admin.query(`explain (analyze, buffers, format json) ${query}`, values);
    performanceResults.queries[name] = {
      elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      executionMs: explain.rows[0]["QUERY PLAN"][0]["Execution Time"],
      plan: explain.rows[0]["QUERY PLAN"][0].Plan["Node Type"],
    };
  }
  check(await scalar(admin, "select count(*)::int from public.rfqs where buyer_message like 'Submitted local RFQ%'") >= 100, "performance RFQs generated", "performance");
  check(await scalar(admin, "select count(*)::int from public.rfq_messages where message like '%performance message%'") === 1000, "performance Messages generated", "performance");
  check(await scalar(admin, "select count(*)::int from public.rfq_quotes q join public.rfqs r on r.id=q.rfq_id where r.buyer_message='Submitted local RFQ'") >= 150, "performance Quotes and revisions generated", "performance");
}

const admin = createClient();
await admin.connect();
try {
  const localHost = (await admin.query("select host(inet_server_addr()) host,inet_server_port() port")).rows[0];
  check(["127.0.0.1", "::1"].includes(localHost.host), "database connection is loopback", "isolation");
  await setupFixtures(admin);
  await runMainLifecycle(admin);
  await runConcurrency(admin);
  const inventory = await runSchemaAndTriggerInventory(admin);
  await runPerformance(admin);

  console.log(JSON.stringify({
    result: "passed",
    databaseHost: localHost.host,
    databasePort: localHost.port,
    assertions: assertionCount,
    sections: Object.fromEntries([...sections.entries()].sort()),
    concurrency,
    performance: performanceResults,
    inventory: {
      rls: inventory.rls,
      functionCount: inventory.functions.length,
      triggerCount: inventory.triggers.length,
    },
    ownerDecision: "Buyer Messages retain the existing vocabulary and intentionally do not emit a new event type; Manufacturer Messages emit manufacturer_replied.",
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    result: "failed",
    assertionsCompleted: assertionCount,
    sqlState: error.code ?? null,
    message: error.message,
    detail: error.detail ?? null,
    where: error.where ?? null,
  }, null, 2));
  process.exitCode = 1;
} finally {
  await admin.end();
}
