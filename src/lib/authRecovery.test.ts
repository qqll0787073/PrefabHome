import assert from "node:assert/strict";
import test from "node:test";
import {
  canSubmitRecoveredPassword,
  clearAuthModeFromSearch,
  fixedAuthRedirect,
  isRecoveryRoute,
  neutralConfirmationMessage,
  neutralRecoveryMessage,
  replaceRecoveredPassword,
  requestConfirmationEmail,
  requestRecoveryEmail,
  validateRecoveredPassword,
} from "./authRecovery";

function authClient(error: unknown = null) {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      async resetPasswordForEmail(email: string, options: { redirectTo: string }) { calls.push(["reset", email, options]); return { error }; },
      async resend(credentials: { type: "signup"; email: string; options: { emailRedirectTo: string } }) { calls.push(["resend", credentials]); return { error }; },
      async updateUser(attributes: { password: string }) { calls.push(["update", attributes]); return { error }; },
    },
  };
}

test("builds fixed same-origin recovery and confirmation destinations", () => {
  assert.equal(fixedAuthRedirect("https://preview.example.test/attacker", "recovery"), "https://preview.example.test/marketplace?auth=recovery");
  assert.equal(fixedAuthRedirect("http://localhost:5173", "confirmed"), "http://localhost:5173/marketplace?auth=confirmed");
  assert.doesNotMatch(fixedAuthRedirect("https://app.example.test", "recovery"), /evil|return|next/);
});

test("recognizes recovery presentation without treating other parameters as recovery", () => {
  assert.equal(isRecoveryRoute("?auth=recovery"), true);
  assert.equal(isRecoveryRoute("?auth=confirmed"), false);
  assert.equal(isRecoveryRoute("?next=https://evil.example"), false);
  assert.equal(clearAuthModeFromSearch("?auth=recovery&workspace=rfqs"), "?workspace=rfqs");
});

test("requests recovery with a neutral response and fixed redirect", async () => {
  const mock = authClient();
  assert.equal(await requestRecoveryEmail(mock.client, " user@example.test ", "https://app.example.test"), neutralRecoveryMessage);
  assert.deepEqual(mock.calls, [["reset", "user@example.test", { redirectTo: "https://app.example.test/marketplace?auth=recovery" }]]);
  assert.doesNotMatch(neutralRecoveryMessage, /user not found|no account|account found/i);
});

test("normalizes every recovery provider response without exposing account existence", async () => {
  const mock = authClient(new Error("User not found: internal-provider-detail"));
  const message = await requestRecoveryEmail(mock.client, "missing@example.test", "https://app.example.test");
  assert.equal(message, neutralRecoveryMessage);
  assert.doesNotMatch(message, /user not found|provider/i);
});

test("resends confirmation neutrally with the fixed confirmation destination", async () => {
  const mock = authClient();
  assert.equal(await requestConfirmationEmail(mock.client, "person@example.test", "https://app.example.test"), neutralConfirmationMessage);
  assert.deepEqual(mock.calls, [["resend", { type: "signup", email: "person@example.test", options: { emailRedirectTo: "https://app.example.test/marketplace?auth=confirmed" } }]]);
});

test("normalizes every confirmation provider response", async () => {
  const mock = authClient(new Error("account does not exist"));
  assert.equal(await requestConfirmationEmail(mock.client, "person@example.test", "https://app.example.test"), neutralConfirmationMessage);
});

test("validates matching password policy and duplicate submission state", () => {
  assert.deepEqual(validateRecoveredPassword("short", "different"), ["Password must be at least 6 characters.", "Passwords must match."]);
  assert.deepEqual(validateRecoveredPassword("long-enough", "long-enough"), []);
  assert.equal(canSubmitRecoveredPassword([], false), true);
  assert.equal(canSubmitRecoveredPassword([], true), false);
});

test("updates only the Supabase password attribute", async () => {
  const mock = authClient();
  await replaceRecoveredPassword(mock.client, "new-password");
  assert.deepEqual(mock.calls, [["update", { password: "new-password" }]]);
  assert.equal(JSON.stringify(mock.calls).includes("role"), false);
  assert.equal(JSON.stringify(mock.calls).includes("status"), false);
  assert.equal(JSON.stringify(mock.calls).includes("application_status"), false);
});

test("normalizes expired or invalid update failures", async () => {
  const mock = authClient(new Error("token expired: sensitive detail"));
  await assert.rejects(replaceRecoveredPassword(mock.client, "new-password"), (error: Error) => {
    assert.match(error.message, /expired or already used/i);
    assert.doesNotMatch(error.message, /token|sensitive/i);
    return true;
  });
});
