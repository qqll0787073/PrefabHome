export const neutralRecoveryMessage =
  "If an account exists for this email, a password recovery message has been sent.";

export function fixedRecoveryRedirect(origin: string): string {
  return new URL("/marketplace?auth=recovery", new URL(origin).origin).toString();
}

export function isRecoveryRoute(search: string): boolean {
  return new URLSearchParams(search).get("auth") === "recovery";
}

export function validateRecoveredPassword(password: string, confirmation: string): string[] {
  const errors: string[] = [];
  if (password.length < 6) {
    errors.push("Password must be at least 6 characters.");
  }
  if (password !== confirmation) errors.push("Passwords must match.");
  return errors;
}

export function recoveryErrorMessage() {
  return "Password recovery could not be completed. The link may be expired or already used. Request a new recovery message and try again.";
}
