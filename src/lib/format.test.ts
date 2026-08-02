import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateOnly } from "./format";

describe("date-only formatting", () => {
  it("keeps SQL dates on their calendar day independent of local timezone", () => {
    assert.equal(formatDateOnly("2026-08-21", "en-US"), "8/21/2026");
    assert.equal(formatDateOnly("2026-01-01", "en-US"), "1/1/2026");
    assert.equal(formatDateOnly("2026-12-31", "en-US"), "12/31/2026");
  });

  it("rejects malformed or impossible SQL dates", () => {
    assert.equal(formatDateOnly("2026-02-30", "en-US"), "Invalid date");
    assert.equal(formatDateOnly("not-a-date", "en-US"), "Invalid date");
    assert.equal(formatDateOnly(null, "en-US"), "Not specified");
  });
});
