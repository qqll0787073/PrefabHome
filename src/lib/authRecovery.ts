export const recoveryAuthMode = "recovery";
export const confirmationAuthMode = "confirmed";
export const neutralRecoveryMessage =
  "If an account exists for this email, a password recovery message has been sent.";
export const neutralConfirmationMessage =
  "If this email has a pending account confirmation, a new confirmation message has been sent.";
export const minimumPasswordLength = 6;

export function fixedAuthRedirect(origin: string, mode: "recovery" | "confirmed"): string {
  const trustedOrigin = new URL(origin).origin;
  const redirect = new URL("/marketplace", trustedOrigin);
  redirect.searchParams.set("auth", mode);
  return redirect.toString();
}

export function isRecoveryRoute(search: string): boolean {
  return new URLSearchParams(search).get("auth") === recoveryAuthMode;
}

export function clearAuthModeFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("auth");
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function validateRecoveredPassword(password: string, confirmation: string): string[] {
  const errors: string[] = [];
  if (password.length < minimumPasswordLength) {
    errors.push(`Password must be at least ${minimumPasswordLength} characters.`);
  }
  if (password !== confirmation) errors.push("Passwords must match.");
  return errors;
}

export function recoveryErrorMessage(): string {
  return "Password recovery could not be completed. The link may be expired or already used. Request a new recovery message and try again.";
}

interface RecoveryAuthClient {
  resetPasswordForEmail: (email: string, options: { redirectTo: string }) => Promise<{ error: unknown }>;
  resend: (credentials: { type: "signup"; email: string; options: { emailRedirectTo: string } }) => Promise<{ error: unknown }>;
  updateUser: (attributes: { password: string }) => Promise<{ error: unknown }>;
}

export async function requestRecoveryEmail(client: RecoveryAuthClient, email: string, origin: string): Promise<string> {
  await client.resetPasswordForEmail(email.trim(), {
    redirectTo: fixedAuthRedirect(origin, recoveryAuthMode),
  });
  return neutralRecoveryMessage;
}

export async function requestConfirmationEmail(client: RecoveryAuthClient, email: string, origin: string): Promise<string> {
  await client.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: fixedAuthRedirect(origin, confirmationAuthMode) },
  });
  return neutralConfirmationMessage;
}

export async function replaceRecoveredPassword(client: RecoveryAuthClient, password: string): Promise<void> {
  const { error } = await client.updateUser({ password });
  if (error) throw new Error(recoveryErrorMessage());
}

export function canSubmitRecoveredPassword(validationErrors: string[], isSubmitting: boolean): boolean {
  return validationErrors.length === 0 && !isSubmitting;
}
