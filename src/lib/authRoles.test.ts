import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRole, isUserRegistrableRole, sanitizeRegistrationRole } from "./authRoles";

describe("auth role safety", () => {
  it("accepts known application roles", () => {
    assert.equal(isRole("buyer"), true);
    assert.equal(isRole("manufacturer"), true);
    assert.equal(isRole("admin"), true);
  });

  it("rejects unknown roles", () => {
    assert.equal(isRole("owner"), false);
    assert.equal(isRole(null), false);
  });

  it("does not allow self-service admin registration", () => {
    assert.equal(isUserRegistrableRole("buyer"), true);
    assert.equal(isUserRegistrableRole("manufacturer"), true);
    assert.equal(isUserRegistrableRole("admin"), false);
  });

  it("sanitizes untrusted registration roles to buyer or manufacturer", () => {
    assert.equal(sanitizeRegistrationRole("manufacturer"), "manufacturer");
    assert.equal(sanitizeRegistrationRole("buyer"), "buyer");
    assert.equal(sanitizeRegistrationRole("admin"), "buyer");
    assert.equal(sanitizeRegistrationRole("anything-else"), "buyer");
  });
});
