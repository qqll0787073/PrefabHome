import assert from "node:assert/strict";
import test from "node:test";
import {
  fixedRecoveryRedirect,
  isRecoveryRoute,
  neutralRecoveryMessage,
  recoveryErrorMessage,
  validateRecoveredPassword,
} from "./authRecovery";

test("builds a fixed same-origin recovery destination", () => {
  assert.equal(fixedRecoveryRedirect("https://preview.example.test/attacker"), "https://preview.example.test/marketplace?auth=recovery");
  assert.equal(fixedRecoveryRedirect("http://localhost:5173"), "http://localhost:5173/marketplace?auth=recovery");
  assert.doesNotMatch(fixedRecoveryRedirect("https://app.example.test"), /evil|return|next/);
});

test("recognizes recovery presentation without treating other parameters as recovery", () => {
  assert.equal(isRecoveryRoute("?auth=recovery"), true);
  assert.equal(isRecoveryRoute("?auth=confirmed"), false);
  assert.equal(isRecoveryRoute("?next=https://evil.example"), false);
});

test("uses a neutral recovery response", () => {
  assert.doesNotMatch(neutralRecoveryMessage, /user not found|no account|account found/i);
});

test("validates matching password policy", () => {
  assert.deepEqual(validateRecoveredPassword("short", "different"), ["Password must be at least 6 characters.", "Passwords must match."]);
  assert.deepEqual(validateRecoveredPassword("long-enough", "long-enough"), []);
});

test("normalizes invalid update failures", () => {
  assert.match(recoveryErrorMessage(), /expired or already used/i);
  assert.doesNotMatch(recoveryErrorMessage(), /token|sensitive/i);
});
