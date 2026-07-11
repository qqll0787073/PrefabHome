import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { roleLabels, viewLabels } from "./constants";

describe("app constants", () => {
  it("keeps all portal role labels available after app split", () => {
    assert.deepEqual(Object.keys(roleLabels), ["buyer", "manufacturer", "admin"]);
  });

  it("keeps all primary view labels available after app split", () => {
    assert.deepEqual(Object.keys(viewLabels), [
      "browse",
      "compare",
      "advisor",
      "import-center",
      "dashboard",
    ]);
  });
});
