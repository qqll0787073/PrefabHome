export const PUBLIC_OPERATOR_PLACEHOLDER = "Pending operator approval before production launch";

export type PublicOperatorPublicationStatus =
  | "pending-operator-approval"
  | "approved-for-publication";

export type PublicContactCategory =
  | "general"
  | "buyer-support"
  | "manufacturer-onboarding"
  | "sales"
  | "partnerships"
  | "accessibility"
  | "privacy"
  | "legal"
  | "press";

export interface PublicContactChannel {
  category: PublicContactCategory;
  label: string;
  owner: string;
  displayValue: string;
  href: string | null;
  publicationStatus: PublicOperatorPublicationStatus;
  note: string;
}

function pendingContact(
  category: PublicContactCategory,
  label: string,
  owner: string,
  note: string,
): PublicContactChannel {
  return {
    category,
    label,
    owner,
    displayValue: PUBLIC_OPERATOR_PLACEHOLDER,
    href: null,
    publicationStatus: "pending-operator-approval",
    note,
  };
}

export const publicContactCategories: PublicContactChannel[] = [
  pendingContact("general", "General Inquiry", "Public Operations", "A monitored general channel must be approved before launch."),
  pendingContact("buyer-support", "Buyer Support", "Buyer Operations", "Private account or transaction information must not be sent through an unapproved public channel."),
  pendingContact("manufacturer-onboarding", "Manufacturer Onboarding", "Manufacturer Operations", "Onboarding questions require an approved organization-controlled channel."),
  pendingContact("sales", "Sales", "Sales Operations", "No quote, price, or response-time promise is made by this placeholder."),
  pendingContact("partnerships", "Partnerships", "Partnerships", "Partnership channels will be activated only after operator approval."),
  pendingContact("accessibility", "Accessibility", "Accessibility Owner", "A monitored barrier-reporting channel requires accessibility and operator approval."),
  pendingContact("privacy", "Privacy", "Privacy Owner", "A privacy request channel requires privacy, legal, and operator approval."),
  pendingContact("legal", "Legal", "Legal Owner", "This placeholder is not an approved legal notice or service channel."),
  pendingContact("press", "Press", "Communications", "A public communications channel must be approved before launch."),
];

const contactByCategory = new Map(publicContactCategories.map((contact) => [contact.category, contact]));

function contact(category: PublicContactCategory): PublicContactChannel {
  const channel = contactByCategory.get(category);
  if (!channel) throw new Error(`Missing public contact category: ${category}`);
  return channel;
}

export const publicOperator = {
  operatorDisplayName: "PrefabHome Marketplace",
  legalEntityName: PUBLIC_OPERATOR_PLACEHOLDER,
  jurisdiction: "Pending legal review",
  businessAddress: PUBLIC_OPERATOR_PLACEHOLDER,
  generalContact: contact("general"),
  supportContact: contact("buyer-support"),
  salesContact: contact("sales"),
  partnershipContact: contact("partnerships"),
  manufacturerOnboardingContact: contact("manufacturer-onboarding"),
  pressContact: contact("press"),
  supportHours: PUBLIC_OPERATOR_PLACEHOLDER,
  privacyContact: contact("privacy"),
  accessibilityContact: contact("accessibility"),
  legalContact: contact("legal"),
  effectiveDate: null as string | null,
  legalReviewStatus: "pending-legal-review" as const,
  publicationStatus: "pending-operator-approval" as PublicOperatorPublicationStatus,
};

export function operatorPublicationLabel(): string {
  return publicOperator.publicationStatus === "approved-for-publication"
    ? "Approved for publication"
    : "Operator information pending approval";
}

export function unresolvedPublicOperatorFields(): string[] {
  const unresolved = [];
  if (publicOperator.publicationStatus !== "approved-for-publication") unresolved.push("operator publication status");
  if (publicOperator.legalEntityName.includes("Pending")) unresolved.push("legal entity name");
  if (publicOperator.jurisdiction.includes("Pending")) unresolved.push("jurisdiction");
  if (publicOperator.businessAddress.includes("Pending")) unresolved.push("business address");
  if (!publicOperator.effectiveDate) unresolved.push("operator effective date");
  if (publicOperator.supportHours.includes("Pending")) unresolved.push("support hours");
  for (const channel of publicContactCategories) {
    if (channel.publicationStatus !== "approved-for-publication" || !channel.href) {
      unresolved.push(`${channel.label} contact`);
    }
  }
  return unresolved;
}
