import type { ProductFormValues } from "../../types";

interface ManufacturerProductFormProps {
  values: ProductFormValues;
  isEditable: boolean;
  onFieldChange: (field: keyof ProductFormValues, value: string) => void;
}

const fields: Array<{ field: keyof ProductFormValues; label: string; inputMode?: "decimal" | "numeric"; placeholder?: string; required?: boolean }> = [
  { field: "sku", label: "SKU" },
  { field: "modelName", label: "Model name", required: true },
  { field: "slug", label: "Marketplace slug", placeholder: "model-name" },
  { field: "category", label: "Category", required: true },
  { field: "shortDescription", label: "Short description" },
  { field: "fobPrice", label: "FOB price", inputMode: "decimal" },
  { field: "currency", label: "Currency", placeholder: "USD" },
  { field: "priceUnit", label: "Price unit" },
  { field: "floorAreaSqFt", label: "Floor area sq ft", inputMode: "decimal" },
  { field: "bedrooms", label: "Bedrooms", inputMode: "numeric" },
  { field: "bathrooms", label: "Bathrooms", inputMode: "decimal" },
  { field: "stories", label: "Stories", inputMode: "numeric" },
  { field: "lengthFt", label: "Length ft", inputMode: "decimal" },
  { field: "widthFt", label: "Width ft", inputMode: "decimal" },
  { field: "heightFt", label: "Height ft", inputMode: "decimal" },
  { field: "productionLeadTimeWeeks", label: "Lead time weeks", inputMode: "numeric" },
  { field: "minimumOrderQuantity", label: "MOQ", inputMode: "numeric" },
  { field: "portOfLoading", label: "Port of loading" },
  { field: "hsCode", label: "HS code" },
  { field: "structureMaterial", label: "Structure material" },
  { field: "exteriorFinish", label: "Exterior finish" },
  { field: "roofType", label: "Roof type" },
  { field: "insulation", label: "Insulation" },
  { field: "electricalStandard", label: "Electrical standard" },
  { field: "plumbingStandard", label: "Plumbing standard" },
  { field: "windRating", label: "Wind rating" },
  { field: "snowLoadPsf", label: "Snow load PSF", inputMode: "decimal" },
  { field: "tags", label: "Tags", placeholder: "ADU, modular, off-grid" },
  { field: "intendedUses", label: "Intended uses", placeholder: "Residential, hospitality" },
  { field: "certifications", label: "Certifications", placeholder: "CE, ISO 9001" },
  { field: "targetMarkets", label: "Target markets", placeholder: "US, Canada" },
];

export function ManufacturerProductForm({ values, isEditable, onFieldChange }: ManufacturerProductFormProps) {
  return <form className="application-form" onSubmit={(event) => event.preventDefault()}>
    {fields.map(({ field, label, inputMode, placeholder, required }) => <label key={field}>{label}<input value={values[field]} inputMode={inputMode} placeholder={placeholder} required={required} disabled={!isEditable} onChange={(event) => onFieldChange(field, event.target.value)} /></label>)}
    <label className="full-width">Description<textarea value={values.description} required disabled={!isEditable} maxLength={5000} onChange={(event) => onFieldChange("description", event.target.value)} /></label>
    <label className="full-width">Private Manufacturer notes<textarea value={values.notes} disabled={!isEditable} maxLength={5000} onChange={(event) => onFieldChange("notes", event.target.value)} /></label>
  </form>;
}
