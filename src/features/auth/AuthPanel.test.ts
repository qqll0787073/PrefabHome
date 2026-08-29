import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AuthPanel,
  buildLoginCredentials,
  buildRegistrationCredentials,
  RegistrationRoleField,
  PasswordRecoveryPanel,
} from "./AuthPanel";

const noopAuthAction = async () => undefined;
const noopEmailAction = async () => "Request received.";

test("login shows a read-only portal entry and database role authority copy", () => {
  const markup = renderToStaticMarkup(createElement(AuthPanel, {
    activeRole: "manufacturer",
    authError: null,
    authMode: "supabase",
    isLoading: false,
    onLogin: noopAuthAction,
    onRegister: noopAuthAction,
    onRequestPasswordRecovery: noopEmailAction,
    onResendConfirmation: noopEmailAction,
  }));

  assert.match(markup, /Signing in to: Manufacturer Portal/);
  assert.match(markup, /actual access is determined by your approved account role/);
  assert.doesNotMatch(markup, /Portal role/);
  assert.doesNotMatch(markup, /<select/);
  assert.match(markup, /id="auth-email"/);
  assert.match(markup, /autoComplete="email"/);
  assert.match(markup, /id="auth-password"/);
  assert.match(markup, /autoComplete="current-password"/);
  assert.match(markup, /aria-busy="false"/);
  assert.match(markup, /Forgot password\?/);
  assert.match(markup, /Resend confirmation email/);
});

test("direct recovery route without a valid recovery event cannot show the password form", () => {
  const markup = renderToStaticMarkup(createElement(PasswordRecoveryPanel, {
    authMode: "supabase",
    recoveryState: "idle",
    recoveryError: null,
    onUpdatePassword: noopAuthAction,
    onClear: () => undefined,
  }));
  assert.match(markup, /Recovery link unavailable/);
  assert.doesNotMatch(markup, /id="recovery-password"/);
});

test("valid Supabase recovery state exposes the accessible matching-password form", () => {
  const markup = renderToStaticMarkup(createElement(PasswordRecoveryPanel, {
    authMode: "supabase",
    recoveryState: "valid",
    recoveryError: null,
    onUpdatePassword: noopAuthAction,
    onClear: () => undefined,
  }));
  assert.match(markup, /Choose a new password/);
  assert.match(markup, /id="recovery-password"/);
  assert.match(markup, /id="recovery-confirmation"/);
  assert.match(markup, /minLength="6"/);
  assert.match(markup, /role, status, and Manufacturer approval are unchanged/);
});

test("demo mode never simulates password recovery", () => {
  const markup = renderToStaticMarkup(createElement(PasswordRecoveryPanel, {
    authMode: "demo",
    recoveryState: "valid",
    recoveryError: null,
    onUpdatePassword: noopAuthAction,
    onClear: () => undefined,
  }));
  assert.match(markup, /not simulated in demo mode/);
  assert.doesNotMatch(markup, /id="recovery-password"/);
});

test("auth failures are announced, associated with credentials, and expose invalid state", () => {
  const markup = renderToStaticMarkup(createElement(AuthPanel, {
    activeRole: "buyer",
    authError: "Sign-in failed.",
    authMode: "supabase",
    isLoading: false,
    onLogin: noopAuthAction,
    onRegister: noopAuthAction,
    onRequestPasswordRecovery: noopEmailAction,
    onResendConfirmation: noopEmailAction,
  }));

  assert.match(markup, /role="alert"/);
  assert.match(markup, /tabindex="-1"/);
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /aria-describedby=/);
  assert.match(markup, /Sign-in failed/);
});

test("registration role field offers Buyer and Manufacturer but never Admin", () => {
  const markup = renderToStaticMarkup(createElement(RegistrationRoleField, {
    value: "buyer",
    onChange: () => undefined,
  }));

  assert.match(markup, /Buyer Portal/);
  assert.match(markup, /Manufacturer Portal/);
  assert.doesNotMatch(markup, /Admin Portal/);
  assert.match(markup, /Admin access is granted only through an operator-controlled process/);
});

test("login intent and registration authority use separate payloads", () => {
  const login = buildLoginCredentials("buyer@example.test", "not-a-real-password", "admin");
  const registration = buildRegistrationCredentials(
    "manufacturer@example.test",
    "not-a-real-password",
    "Example Manufacturer",
    "manufacturer",
  );

  assert.deepEqual(login, {
    email: "buyer@example.test",
    password: "not-a-real-password",
    intendedPortal: "admin",
  });
  assert.equal("role" in login, false);
  assert.equal(registration.role, "manufacturer");
  assert.equal("intendedPortal" in registration, false);
});
