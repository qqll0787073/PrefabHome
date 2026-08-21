import React from "react";
import type { AuthUser } from "../../lib/auth";
import type { ManufacturerCompanyProfileValues } from "../../lib/manufacturers";
import type { ManufacturerApplication } from "../../types";

interface Props {
  application: ManufacturerApplication;
  user: AuthUser;
  values: ManufacturerCompanyProfileValues;
  disabled: boolean;
  accountStatus: string;
  onFieldChange: (field: keyof ManufacturerCompanyProfileValues, value: string) => void;
}

function field(label: string, key: keyof ManufacturerCompanyProfileValues, values: ManufacturerCompanyProfileValues, disabled: boolean, onChange: Props["onFieldChange"], type = "text") {
  return <label>{label}<input type={type} value={values[key]} disabled={disabled} onChange={(event) => onChange(key, event.target.value)} /></label>;
}

export function ManufacturerCompanyProfileForm({ application, user, values, disabled, accountStatus, onFieldChange }: Props) {
  return <div className="company-profile-sections">
    <section aria-labelledby="public-company-information"><h3 id="public-company-information">Buyer-visible company information</h3><p>These details appear in the approved Manufacturer directory.</p><div className="application-form">
      {field("Company display name", "companyDisplayName", values, disabled, onFieldChange)}
      {field("Website", "website", values, disabled, onFieldChange, "url")}
      {field("City", "city", values, disabled, onFieldChange)}
      {field("Province/state", "province", values, disabled, onFieldChange)}
      <label className="full-width">Company description<textarea value={values.companyDescription} disabled={disabled} onChange={(event) => onFieldChange("companyDescription", event.target.value)} /></label>
    </div></section>
    <section aria-labelledby="private-company-information"><h3 id="private-company-information">Private company contact and address</h3><p>These details are available to your company and authorized administrators, not the Buyer directory.</p><div className="application-form">
      {field("Contact person", "contactPerson", values, disabled, onFieldChange)}
      {field("Contact title", "contactTitle", values, disabled, onFieldChange)}
      {field("Contact email", "email", values, disabled, onFieldChange, "email")}
      {field("Phone", "phone", values, disabled, onFieldChange)}
      {field("Street address", "streetAddress", values, disabled, onFieldChange)}
      {field("Postal code", "postalCode", values, disabled, onFieldChange)}
    </div></section>
    <section aria-labelledby="reviewed-company-details"><h3 id="reviewed-company-details">Reviewed company details</h3><p>These approval-sensitive details are read-only. Contact support if they require review.</p><dl className="status-list">
      <div><dt>Legal name</dt><dd>{application.company_legal_name ?? "Not provided"}</dd></div>
      <div><dt>Country</dt><dd>{application.country}</dd></div>
      <div><dt>Year established</dt><dd>{application.year_established ?? "Not provided"}</dd></div>
      <div><dt>Export experience</dt><dd>{application.export_experience ?? "Not provided"}</dd></div>
      <div><dt>Product categories</dt><dd>{application.product_categories.join(", ") || "Not provided"}</dd></div>
      <div><dt>Certifications</dt><dd>{application.certifications.join(", ") || "Not provided"}</dd></div>
    </dl></section>
    <section aria-labelledby="manufacturer-account-identity"><h3 id="manufacturer-account-identity">Account identity and status</h3><p>Authentication and authority are managed separately from company profile fields.</p><dl className="status-list">
      <div><dt>Signed-in email</dt><dd>{user.email}</dd></div><div><dt>Account role</dt><dd>Manufacturer</dd></div><div><dt>Account status</dt><dd>{accountStatus}</dd></div>
    </dl></section>
  </div>;
}
