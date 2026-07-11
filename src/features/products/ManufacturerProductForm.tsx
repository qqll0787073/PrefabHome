import type { ProductFormValues } from "../../types";

interface ManufacturerProductFormProps {
  values: ProductFormValues;
  isEditable: boolean;
  onFieldChange: (field: keyof ProductFormValues, value: string) => void;
}

export function ManufacturerProductForm({
  values,
  isEditable,
  onFieldChange,
}: ManufacturerProductFormProps) {
  return (
    <form className="application-form">
      <label>
        SKU
        <input
          value={values.sku}
          onChange={(event) => onFieldChange("sku", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Model name
        <input
          value={values.modelName}
          onChange={(event) => onFieldChange("modelName", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
      <label>
        Slug
        <input
          value={values.slug}
          onChange={(event) => onFieldChange("slug", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Category
        <input
          value={values.category}
          onChange={(event) => onFieldChange("category", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
      <label>
        FOB price
        <input
          inputMode="decimal"
          value={values.fobPrice}
          onChange={(event) => onFieldChange("fobPrice", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Currency
        <input
          value={values.currency}
          onChange={(event) => onFieldChange("currency", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Floor area sq ft
        <input
          inputMode="decimal"
          value={values.floorAreaSqFt}
          onChange={(event) => onFieldChange("floorAreaSqFt", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Bedrooms
        <input
          inputMode="numeric"
          value={values.bedrooms}
          onChange={(event) => onFieldChange("bedrooms", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Bathrooms
        <input
          inputMode="decimal"
          value={values.bathrooms}
          onChange={(event) => onFieldChange("bathrooms", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Lead time weeks
        <input
          inputMode="numeric"
          value={values.productionLeadTimeWeeks}
          onChange={(event) => onFieldChange("productionLeadTimeWeeks", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        MOQ
        <input
          inputMode="numeric"
          value={values.minimumOrderQuantity}
          onChange={(event) => onFieldChange("minimumOrderQuantity", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Port of loading
        <input
          value={values.portOfLoading}
          onChange={(event) => onFieldChange("portOfLoading", event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label>
        Tags
        <input
          value={values.tags}
          onChange={(event) => onFieldChange("tags", event.target.value)}
          disabled={!isEditable}
          placeholder="ADU, modular, off-grid"
        />
      </label>
      <label>
        Certifications
        <input
          value={values.certifications}
          onChange={(event) => onFieldChange("certifications", event.target.value)}
          disabled={!isEditable}
          placeholder="CE, ISO 9001"
        />
      </label>
      <label>
        Target markets
        <input
          value={values.targetMarkets}
          onChange={(event) => onFieldChange("targetMarkets", event.target.value)}
          disabled={!isEditable}
          placeholder="US, Canada"
        />
      </label>
      <label className="full-width">
        Description
        <textarea
          value={values.description}
          onChange={(event) => onFieldChange("description", event.target.value)}
          disabled={!isEditable}
          required
        />
      </label>
      <label className="full-width">
        Notes
        <textarea
          value={values.notes}
          onChange={(event) => onFieldChange("notes", event.target.value)}
          disabled={!isEditable}
        />
      </label>
    </form>
  );
}
