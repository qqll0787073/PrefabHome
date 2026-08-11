import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { BuyerManufacturersWorkspace } from "./BuyerManufacturersWorkspace";

test("initial directory loading state is accessible and stable", () => {
  const html = renderToStaticMarkup(createElement(BuyerManufacturersWorkspace, { selectedManufacturerId: null, onSelectedManufacturerChange: () => undefined }));
  assert.match(html, /aria-labelledby="buyer-manufacturers-heading"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /role="status"/);
  assert.match(html, /Loading manufacturers/);
});
test("workspace has no RFQ, generic messaging, private profile, or unsafe HTML bypass", () => {
  const source = readFileSync(new URL("./BuyerManufacturersWorkspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /send_rfq|create_rfq|Contact Manufacturer|start.*chat|dangerouslySetInnerHTML|\.from\(["']profiles/);
  assert.match(source, /\/products\//);
});
