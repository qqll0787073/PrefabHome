import type { Role } from "../types";

const userRegistrableRoles = new Set<Role>(["buyer", "manufacturer"]);
const allRoles = new Set<Role>(["buyer", "manufacturer", "admin"]);

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && allRoles.has(value as Role);
}

export function sanitizeRegistrationRole(value: unknown): Exclude<Role, "admin"> {
  return value === "manufacturer" ? "manufacturer" : "buyer";
}

export function isUserRegistrableRole(value: unknown): value is Exclude<Role, "admin"> {
  return typeof value === "string" && userRegistrableRoles.has(value as Role);
}
