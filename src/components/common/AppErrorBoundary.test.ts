import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppErrorFallback,
  installGlobalRuntimeErrorListeners,
  retryBoundaryState,
} from "./AppErrorBoundary";
import type { SafeLogRecord, SafeLogger } from "../../lib/observability/safeLogger";

const release = {
  environment: "staging" as const,
  appVersion: "1.0.0",
  commitSha: "abcdef1234567890",
};

test("application fallback renders accessible safe recovery controls", () => {
  const markup = renderToStaticMarkup(
    createElement(AppErrorFallback, {
      incidentId: "INC-SAFE-123",
      release,
      onRetry: () => undefined,
      onReload: () => undefined,
    })
  );
  assert.match(markup, /role="alert"/);
  assert.match(markup, /PrefabHome could not continue/);
  assert.match(markup, /Retry PrefabHome application/);
  assert.match(markup, /Reload PrefabHome page/);
  assert.match(markup, /INC-SAFE-123/);
  assert.match(markup, /abcdef123456/);
  assert.doesNotMatch(markup, /stack|access_token|signedUrl/);
});

test("retry clears the incident and remounts the child tree", () => {
  assert.deepEqual(
    retryBoundaryState({ hasError: true, incidentId: "INC-OLD", resetKey: 2 }),
    { hasError: false, incidentId: null, resetKey: 3 }
  );
});

test("global runtime listeners deduplicate repeated errors and clean up", () => {
  const listeners = new Map<string, EventListener>();
  const target = {
    addEventListener(type: string, listener: EventListener) {
      listeners.set(type, listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  const records: SafeLogRecord[] = [];
  const logger: SafeLogger = {
    info: () => undefined,
    warn: () => undefined,
    error: (message, context) => records.push({ level: "error", message, context, timestamp: "now" }),
  };
  const cleanup = installGlobalRuntimeErrorListeners(target as unknown as Window, logger, release);
  const repeatedError = new Error("render failed");
  listeners.get("error")?.({ error: repeatedError, message: repeatedError.message } as unknown as Event);
  listeners.get("error")?.({ error: repeatedError, message: repeatedError.message } as unknown as Event);
  assert.equal(records.length, 1);
  cleanup();
  assert.equal(listeners.size, 0);
});
