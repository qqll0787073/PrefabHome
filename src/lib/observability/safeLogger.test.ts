import assert from "node:assert/strict";
import test from "node:test";
import { createSafeLogger, redactString, sanitizeLogValue, type SafeLogRecord } from "./safeLogger";

test("redacts nested access tokens and Authorization headers", () => {
  const sanitized = sanitizeLogValue({
    headers: { Authorization: "Bearer private-value", Cookie: "session=private" },
    session: { access_token: "access-private", refresh_token: "refresh-private" },
  }) as Record<string, unknown>;
  const serialized = JSON.stringify(sanitized);
  assert.doesNotMatch(serialized, /private-value|access-private|refresh-private|session=private/);
  assert.match(serialized, /\[REDACTED\]/);
});

test("redacts Authorization and password values embedded in messages", () => {
  const output = redactString("Authorization: Bearer private-header password=private-password");
  assert.equal(output.includes("private-header"), false);
  assert.equal(output.includes("private-password"), false);
  assert.match(output, /Authorization=\[REDACTED\]/i);
});

test("redacts JWT-like strings", () => {
  const jwt = ["eyJhbGciOiJIUzI1NiJ9", "eyJzdWIiOiJ0ZXN0LXVzZXIifQ", "signaturevalue12345"].join(".");
  const output = redactString(`token=${jwt}`);
  assert.equal(output.includes(jwt), false);
  assert.match(output, /\[REDACTED_JWT\]/);
});

test("redacts signed URL query parameters", () => {
  const output = redactString(
    "https://project.invalid/storage/v1/object/sign/product-images/file.png?token=temporary-signature"
  );
  assert.equal(output.includes("temporary-signature"), false);
  assert.equal(output, "https://project.invalid/storage/v1/object/sign/product-images/file.png?[REDACTED]");
});

test("safe Error serialization omits stacks and custom fields", () => {
  const error = Object.assign(new Error("Request failed for person@example.com"), {
    access_token: "custom-private-token",
    invoice: { total: 5000 },
  });
  const sanitized = sanitizeLogValue(error) as Record<string, unknown>;
  assert.deepEqual(Object.keys(sanitized).sort(), ["message", "name"]);
  assert.equal(JSON.stringify(sanitized).includes("custom-private-token"), false);
  assert.equal(JSON.stringify(sanitized).includes("person@example.com"), false);
  assert.equal("stack" in sanitized, false);
});

test("safe logger emits typed sanitized records through a provider-neutral sink", () => {
  const records: SafeLogRecord[] = [];
  const logger = createSafeLogger({ write: (record) => records.push(record) });
  logger.warn("Contact person@example.com", { password: "private-password" });
  assert.equal(records.length, 1);
  assert.equal(records[0].level, "warn");
  assert.equal(records[0].message, "Contact [REDACTED_EMAIL]");
  assert.equal(JSON.stringify(records[0].context).includes("private-password"), false);
});
