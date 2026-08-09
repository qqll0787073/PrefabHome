import React from "react";
import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BuyerRFQEmptyState, BuyerRFQLoadError, BuyerRFQLoadingState, shouldHandleBuyerRFQNavigation } from "./BuyerRFQDashboard";

test("true empty state links to the Marketplace", () => { const html = renderToStaticMarkup(<BuyerRFQEmptyState />); assert.match(html, /You have not submitted any RFQs yet/); assert.match(html, /href="\/marketplace\?view=browse"/); });
test("loading state is accessible and layout is busy", () => { const html = renderToStaticMarkup(<BuyerRFQLoadingState />); assert.match(html, /aria-busy="true"/); assert.match(html, /role="status"/); assert.match(html, /Loading your RFQs/); });
test("load error is sanitized and offers Retry", () => { const html = renderToStaticMarkup(<BuyerRFQLoadError onRetry={() => {}} />); assert.match(html, /Unable to load your RFQs/); assert.match(html, />Retry</); assert.doesNotMatch(html, /supabase|sql|jwt|endpoint/i); });
test("RFQ links intercept only unmodified primary clicks", () => { const base = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, currentTarget: { target: "", hasAttribute: () => false } }; assert.equal(shouldHandleBuyerRFQNavigation(base as never), true); for (const changed of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) assert.equal(shouldHandleBuyerRFQNavigation({ ...base, ...changed } as never), false); });
