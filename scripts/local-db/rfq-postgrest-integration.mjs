import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import process from "node:process";

const apiUrl = process.env.PREFAB_DISPOSABLE_POSTGREST_URL;
const jwtSecret = process.env.PREFAB_DISPOSABLE_JWT_SECRET;
if (!apiUrl || !jwtSecret) throw new Error("Disposable PostgREST URL and JWT secret are required.");
const parsed = new URL(apiUrl);
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname), "PostgREST host must be loopback.");
assert.ok(jwtSecret.length >= 32, "Disposable JWT secret must be at least 32 bytes.");

const ids = {
  buyerA: "10000000-0000-4000-8000-000000000001",
  manufacturerAUser: "10000000-0000-4000-8000-000000000101",
  manufacturerBUser: "10000000-0000-4000-8000-000000000102",
  admin: "10000000-0000-4000-8000-000000000201",
  product: "30000000-0000-4000-8000-000000000001",
};

let assertions = 0;
function check(condition, name) {
  assert.ok(condition, name);
  assertions += 1;
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function token(userId) {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    sub: userId,
    role: "authenticated",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  }));
  const signature = createHmac("sha256", jwtSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

async function request(path, { userId, method = "GET", body, prefer } = {}) {
  const response = await fetch(new URL(path, apiUrl), {
    method,
    headers: {
      ...(userId ? { Authorization: `Bearer ${token(userId)}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, data };
}

function row(data) {
  return Array.isArray(data) ? data[0] : data;
}

const create = await request("/rpc/create_rfq_draft", {
  userId: ids.buyerA,
  method: "POST",
  body: {
    product_uuid: ids.product,
    requested_quantity_value: 2,
    requested_currency_value: "USD",
    destination_country_value: "US",
    incoterm_value: "FOB",
    destination_port_value: "New York",
    target_delivery_date_value: "2031-01-20",
    buyer_message_value: "PostgREST local draft",
  },
});
check(
  create.status === 200,
  `Buyer draft RPC succeeds through PostgREST (status ${create.status}: ${JSON.stringify(create.data)})`,
);
const draft = row(create.data);
check(draft?.status === "draft" && draft?.buyer_id === ids.buyerA, "draft result shape and derived Buyer match");

const buyerRead = await request(`/rfqs?id=eq.${draft.id}`, { userId: ids.buyerA });
check(buyerRead.status === 200 && buyerRead.data.length === 1, "Buyer reads own draft through API");
const manufacturerDraftRead = await request(`/rfqs?id=eq.${draft.id}`, { userId: ids.manufacturerAUser });
check(manufacturerDraftRead.status === 200 && manufacturerDraftRead.data.length === 0, "Manufacturer draft API read is empty");
const anonymousRead = await request(`/rfqs?id=eq.${draft.id}`);
check([401, 403].includes(anonymousRead.status), "Anonymous private RFQ API read denied");

const update = await request("/rpc/update_rfq_draft", {
  userId: ids.buyerA,
  method: "POST",
  body: {
    rfq_uuid: draft.id,
    requested_quantity_value: 3,
    requested_currency_value: "USD",
    destination_country_value: "CA",
    incoterm_value: "CIF",
    destination_port_value: "Vancouver",
    target_delivery_date_value: "2031-02-20",
    buyer_message_value: "PostgREST edited draft",
  },
});
check(update.status === 200 && row(update.data).id === draft.id, "draft update preserves UUID through API");

const submit = await request("/rpc/submit_rfq", {
  userId: ids.buyerA,
  method: "POST",
  body: {
    rfq_uuid: draft.id,
    requested_quantity_value: 3,
    requested_currency_value: "USD",
    destination_country_value: "CA",
    incoterm_value: "CIF",
    destination_port_value: "Vancouver",
    target_delivery_date_value: "2031-02-20",
    buyer_message_value: "PostgREST submitted draft",
  },
});
check(submit.status === 200 && row(submit.data).id === draft.id && row(submit.data).status === "submitted", "saved draft submits in place through API");
const buyerCount = await request(`/rfqs?id=eq.${draft.id}&select=id`, { userId: ids.buyerA });
check(buyerCount.data.length === 1, "API submission leaves one RFQ record");
const manufacturerRead = await request(`/rfqs?id=eq.${draft.id}`, { userId: ids.manufacturerAUser });
check(manufacturerRead.status === 200 && manufacturerRead.data.length === 1, "assigned Manufacturer sees submitted RFQ through API");
const otherManufacturerRead = await request(`/rfqs?id=eq.${draft.id}`, { userId: ids.manufacturerBUser });
check(otherManufacturerRead.status === 200 && otherManufacturerRead.data.length === 0, "unrelated Manufacturer sees no RFQ through API");

const adminMutation = await request("/rpc/cancel_rfq", { userId: ids.admin, method: "POST", body: { rfq_uuid: draft.id } });
check(adminMutation.status >= 400, "Admin participant mutation RPC denied through API");

const buyerMessage = await request("/rpc/send_rfq_message", {
  userId: ids.buyerA,
  method: "POST",
  body: { rfq_uuid: draft.id, message_text: "API Buyer message", attachment_path_value: null },
});
check(buyerMessage.status === 200 && row(buyerMessage.data).sender_role === "buyer", "Buyer Message role is database derived through API");
const manufacturerMessage = await request("/rpc/send_rfq_message", {
  userId: ids.manufacturerAUser,
  method: "POST",
  body: { rfq_uuid: draft.id, message_text: "API Manufacturer message", attachment_path_value: null },
});
check(manufacturerMessage.status === 200 && row(manufacturerMessage.data).sender_role === "manufacturer", "Manufacturer Message role is database derived through API");

const quoteDraftResponse = await request("/rpc/create_rfq_quote_draft", {
  userId: ids.manufacturerAUser,
  method: "POST",
  body: { rfq_uuid: draft.id },
});
check(quoteDraftResponse.status === 200, "Manufacturer creates Quote draft through API");
const quote = row(quoteDraftResponse.data);
const item = await request("/rfq_quote_items", {
  userId: ids.manufacturerAUser,
  method: "POST",
  prefer: "return=representation",
  body: {
    quote_id: quote.id,
    line_order: 1,
    item_type: "product",
    description: "API prefab home",
    quantity: 1,
    unit: "unit",
    unit_price: 150000,
  },
});
check(item.status === 201 && item.data.length === 1, "Manufacturer adds Quote item through API");

const quoteSubmit = await request("/rpc/submit_rfq_quote", {
  userId: ids.manufacturerAUser,
  method: "POST",
  body: { quote_uuid: quote.id },
});
check(quoteSubmit.status === 200 && row(quoteSubmit.data).status === "submitted", "Quote submission succeeds through API");
const quoteRetry = await request("/rpc/submit_rfq_quote", {
  userId: ids.manufacturerAUser,
  method: "POST",
  body: { quote_uuid: quote.id },
});
check(quoteRetry.status === 200 && row(quoteRetry.data).id === quote.id, "Quote timeout retry resolves through API");
const otherSubmit = await request("/rpc/submit_rfq_quote", {
  userId: ids.manufacturerBUser,
  method: "POST",
  body: { quote_uuid: quote.id },
});
check(otherSubmit.status >= 400, "unrelated Manufacturer Quote submission denied through API");
const buyerQuote = await request(`/rfq_quotes?id=eq.${quote.id}`, { userId: ids.buyerA });
check(buyerQuote.status === 200 && buyerQuote.data.length === 1, "Buyer reads submitted Quote through API");

console.log(JSON.stringify({
  result: "passed",
  apiHost: parsed.hostname,
  apiPort: parsed.port,
  assertions,
  returnedShapes: {
    rfqComposite: Array.isArray(create.data) ? "array" : "object",
    quoteComposite: Array.isArray(quoteSubmit.data) ? "array" : "object",
  },
}, null, 2));
