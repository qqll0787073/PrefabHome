import assert from "node:assert/strict";
import test from "node:test";
import { publicStatusPages } from "./publicStatusPages";

test("public status model includes the complete safe status inventory", () => {
  assert.deepEqual(Object.keys(publicStatusPages).map(Number), [401, 403, 404, 429, 500, 503]);
  for (const page of Object.values(publicStatusPages)) {
    assert.ok(page.heading);
    assert.ok(page.summary);
    assert.ok(page.actions.length > 0);
  }
});

test("public error content exposes no technical or authorization override data", () => {
  const serialized = JSON.stringify(publicStatusPages);
  assert.doesNotMatch(serialized, /stack trace:|access[_-]?token|refresh[_-]?token|password|service[_-]?role/i);
  assert.match(publicStatusPages[401].detail, /does not change your approved account role/i);
  assert.match(publicStatusPages[403].detail, /cannot grant access/i);
  assert.doesNotMatch(publicStatusPages[429].detail, /\b\d+\s*(?:seconds?|minutes?|hours?)\b/i);
  assert.match(publicStatusPages[503].detail, /does not imply/i);
});
