export type PublicStatusCode = 401 | 403 | 404 | 429 | 500 | 503;
export type PublicStatusAction = "home" | "marketplace" | "retry" | "reload";

export interface PublicStatusPageDefinition {
  status: PublicStatusCode;
  eyebrow: string;
  heading: string;
  summary: string;
  detail: string;
  actions: PublicStatusAction[];
}

export const publicStatusPages: Record<PublicStatusCode, PublicStatusPageDefinition> = {
  401: {
    status: 401,
    eyebrow: "Authentication required",
    heading: "Sign in to continue",
    summary: "This area requires an authenticated PrefabHome account.",
    detail: "Signing in does not change your approved account role. Access remains controlled by your database profile and existing authorization policies.",
    actions: ["marketplace", "home"],
  },
  403: {
    status: 403,
    eyebrow: "Access denied",
    heading: "This account cannot open that area",
    summary: "The requested action is not available to the approved role for this account.",
    detail: "Changing a portal selection cannot grant access or override database authorization. Return to an available workspace or the public site.",
    actions: ["marketplace", "home"],
  },
  404: {
    status: 404,
    eyebrow: "Page not found",
    heading: "Public page not found",
    summary: "The requested public page is not available.",
    detail: "No portal, account, transaction, or technical error information is exposed here.",
    actions: ["home", "marketplace"],
  },
  429: {
    status: 429,
    eyebrow: "Request limit",
    heading: "Too many requests",
    summary: "The requested operation cannot continue right now.",
    detail: "Wait before trying again. No reset time is promised because the application does not have a reliable public value to display.",
    actions: ["retry", "home"],
  },
  500: {
    status: 500,
    eyebrow: "Application safety response",
    heading: "PrefabHome could not continue",
    summary: "The current view stopped safely.",
    detail: "Retry the application or reload this page. No raw diagnostic details, credential, or private record is shown here.",
    actions: ["retry", "reload"],
  },
  503: {
    status: 503,
    eyebrow: "Temporarily unavailable",
    heading: "This service is temporarily unavailable",
    summary: "The requested service cannot continue right now.",
    detail: "Try again later or return home. This message does not imply that an outage-monitoring or response system is active.",
    actions: ["retry", "home"],
  },
};

export function publicStatusPage(status: PublicStatusCode): PublicStatusPageDefinition {
  return publicStatusPages[status];
}
