import type { Role, View } from "../types";

export const roleLabels: Record<Role, string> = {
  buyer: "Buyer Portal",
  manufacturer: "Manufacturer Portal",
  admin: "Admin Portal",
};

export const viewLabels: Record<View, string> = {
  browse: "Browse",
  compare: "Compare",
  advisor: "AI Advisor",
  "import-center": "Import Center",
  dashboard: "Dashboard",
};

export const importDocumentChecklist = [
  "Commercial invoice",
  "Packing list",
  "Bill of lading",
  "Material certificates",
];
