import type { ManufacturerApplicationFormValues } from "../../types";

interface ManufacturerApplicationFormProps {
  values: ManufacturerApplicationFormValues;
  isEditable: boolean;
  onFieldChange: (field: keyof ManufacturerApplicationFormValues, value: string) => void;
}

export function ManufacturerApplicationForm({
  values,
  isEditable,
  onFieldChange,
}: ManufacturerApplicationFormProps) {
  return (
    <form className="application-form">
      <label>
        Company legal name
        <input
          value={values.companyLegalName}
          onChange={(event) => onFieldChange("companyLegalName", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
      <label>
        Company display name
        <input
          value={values.companyDisplayName}
          onChange={(event) => onFieldChange("companyDisplayName", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
      <label>
        Contact person
        <input
          value={values.contactPerson}
          onChange={(event) => onFieldChange("contactPerson", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
      <label>
        Contact title
        <input
          value={values.contactTitle}
          onChange={(event) => onFieldChange("contactTitle", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={values.email}
          onChange={(event) => onFieldChange("email", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
      <label>
        Phone
        <input
          value={values.phone}
          onChange={(event) => onFieldChange("phone", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Website
        <input
          type="url"
          value={values.website}
          onChange={(event) => onFieldChange("website", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Country
        <input
          value={values.country}
          onChange={(event) => onFieldChange("country", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
      <label>
        Province/state
        <input
          value={values.province}
          onChange={(event) => onFieldChange("province", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        City
        <input
          value={values.city}
          onChange={(event) => onFieldChange("city", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
      <label>
        Street address
        <input
          value={values.streetAddress}
          onChange={(event) => onFieldChange("streetAddress", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Postal code
        <input
          value={values.postalCode}
          onChange={(event) => onFieldChange("postalCode", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Year established
        <input
          inputMode="numeric"
          value={values.yearEstablished}
          onChange={(event) => onFieldChange("yearEstablished", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Export experience
        <input
          value={values.exportExperience}
          onChange={(event) => onFieldChange("exportExperience", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Product categories
        <input
          value={values.productCategories}
          onChange={(event) => onFieldChange("productCategories", event.target.value)}
          placeholder="ADU, tiny house, container house"
          disabled={!isEditable}
          required
        />
      </label>
      <label>
        Certifications
        <input
          value={values.certifications}
          onChange={(event) => onFieldChange("certifications", event.target.value)}
          placeholder="ISO 9001, CE, CSA"
          disabled={!isEditable}
        />
      </label>
      <label className="full-width">
        Company description
        <textarea
          value={values.companyDescription}
          onChange={(event) => onFieldChange("companyDescription", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
    </form>
  );
}
