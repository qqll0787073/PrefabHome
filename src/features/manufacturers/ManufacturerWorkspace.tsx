import { useEffect, useState } from "react";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  createManufacturerApplication,
  emptyManufacturerApplicationForm,
  fetchOwnManufacturerApplication,
  formFromApplication,
  manufacturerEditableStatuses,
  manufacturerSubmittableStatuses,
  submitManufacturerApplication,
  updateManufacturerApplication,
  validateManufacturerApplication,
} from "../../lib/manufacturers";
import type { AuthUser } from "../../lib/auth";
import type {
  ManufacturerApplication,
  ManufacturerApplicationFormValues,
} from "../../types";
import { ManufacturerApplicationForm } from "./ManufacturerApplicationForm";
import { ManufacturerStatusPanel } from "./ManufacturerStatusPanel";

interface ManufacturerWorkspaceProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
}

export function ManufacturerWorkspace({ user, authMode }: ManufacturerWorkspaceProps) {
  const [application, setApplication] = useState<ManufacturerApplication | null>(null);
  const [values, setValues] = useState<ManufacturerApplicationFormValues>(() =>
    emptyManufacturerApplicationForm(user.email)
  );
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadApplication() {
      setIsLoading(true);
      setErrors([]);

      try {
        const existingApplication = await fetchOwnManufacturerApplication(user.id);
        if (!isMounted) return;

        setApplication(existingApplication);
        setValues(
          existingApplication
            ? formFromApplication(existingApplication)
            : emptyManufacturerApplicationForm(user.email)
        );
      } catch (error) {
        if (isMounted) {
          setErrors([error instanceof Error ? error.message : "Unable to load application."]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (authMode === "demo") {
      setValues(emptyManufacturerApplicationForm(user.email));
      setIsLoading(false);
      return;
    }

    void loadApplication();

    return () => {
      isMounted = false;
    };
  }, [authMode, user.email, user.id]);

  function updateField(field: keyof ManufacturerApplicationFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  const isEditable =
    !application || manufacturerEditableStatuses.includes(application.application_status);
  const canSubmit =
    !application || manufacturerSubmittableStatuses.includes(application.application_status);

  async function saveApplication(action: "draft" | "submit") {
    const isSubmit = action === "submit";
    const validationErrors = validateManufacturerApplication(values, {
      requireComplete: isSubmit,
    });
    setErrors(validationErrors);
    setMessage(null);

    if (validationErrors.length > 0) return;

    setIsSaving(true);

    try {
      if (authMode === "demo") {
        const now = new Date().toISOString();
        const demoApplication: ManufacturerApplication = {
          id: application?.id ?? `demo-manufacturer-${user.id}`,
          owner_id: user.id,
          company_name:
            values.companyDisplayName.trim() ||
            values.companyLegalName.trim() ||
            "Untitled manufacturer application",
          company_legal_name: values.companyLegalName.trim() || null,
          company_display_name: values.companyDisplayName.trim() || null,
          contact_person: values.contactPerson.trim() || null,
          contact_title: values.contactTitle.trim() || null,
          email: values.email.trim() || null,
          phone: values.phone.trim() || null,
          website: values.website.trim() || null,
          country: values.country.trim() || "Unspecified",
          province: values.province.trim() || null,
          city: values.city.trim() || null,
          street_address: values.streetAddress.trim() || null,
          postal_code: values.postalCode.trim() || null,
          year_established: values.yearEstablished.trim()
            ? Number(values.yearEstablished.trim())
            : null,
          export_experience: values.exportExperience.trim() || null,
          product_categories: values.productCategories
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          certifications: values.certifications
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          company_description: values.companyDescription.trim() || null,
          application_status: isSubmit ? "submitted" : application?.application_status ?? "draft",
          review_notes: application?.review_notes ?? null,
          reviewed_by: application?.reviewed_by ?? null,
          reviewed_at: application?.reviewed_at ?? null,
          submitted_at: isSubmit ? now : application?.submitted_at ?? null,
          created_at: application?.created_at ?? now,
          updated_at: now,
        };

        setApplication(demoApplication);
        setMessage(
          isSubmit
            ? "Demo application submitted."
            : "Demo application draft saved."
        );
        return;
      }

      const savedApplication = application
        ? isSubmit
          ? await submitManufacturerApplication(application.id, values)
          : await updateManufacturerApplication(application.id, values)
        : await createManufacturerApplication(user.id, values, isSubmit ? "submitted" : "draft");

      setApplication(savedApplication);
      setMessage(
        isSubmit
          ? "Application submitted for admin review."
          : application
            ? "Application draft updated."
            : "Application draft saved."
      );
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Unable to save application."]);
    } finally {
      setIsSaving(false);
    }
  }

  function editableMessage() {
    if (!application || isEditable) return null;

    return application.application_status === "submitted" ||
      application.application_status === "under_review"
      ? "This application is locked during review. An admin must return it to draft or reject it before manufacturer edits are allowed."
      : "This application is not currently editable by the manufacturer.";
  }

  return (
    <section className="workspace-section">
      <ManufacturerStatusPanel application={application} />

      <section className="panel">
        <p className="eyebrow">Manufacturer Onboarding</p>
        <h2>Company profile</h2>
        {editableMessage() && <p className="form-notice">{editableMessage()}</p>}
        {isLoading ? (
          <LoadingState message="Loading manufacturer application..." />
        ) : (
          <ManufacturerApplicationForm
            values={values}
            isEditable={isEditable}
            onFieldChange={updateField}
          />
        )}

        <ErrorList errors={errors} />
        {message && <p className="form-success">{message}</p>}

        <div className="actions">
          {isEditable && (
            <button
              type="button"
              disabled={isSaving || isLoading}
              onClick={() => void saveApplication("draft")}
            >
              Save Draft
            </button>
          )}
          {canSubmit && (
            <button
              type="button"
              disabled={isSaving || isLoading}
              onClick={() => void saveApplication("submit")}
            >
              {isSaving ? "Saving..." : "Submit Application"}
            </button>
          )}
        </div>
      </section>
    </section>
  );
}
