import { useEffect, useRef, useState } from "react";
export { BuyerManufacturersWorkspace } from "./BuyerManufacturersWorkspace";
import { ErrorList } from "../../components/common/ErrorList";
import { LoadingState } from "../../components/common/LoadingState";
import {
  emptyManufacturerApplicationForm,
  companyProfileFromApplication,
  fetchOwnManufacturerAccount,
  formFromApplication,
  manufacturerEditableStatuses,
  saveManufacturerApplication,
  updateManufacturerCompanyProfile,
  validateManufacturerCompanyProfile,
  type ManufacturerCompanyProfileValues,
  validateManufacturerApplication,
} from "../../lib/manufacturers";
import type { AuthUser } from "../../lib/auth";
import type {
  ManufacturerApplication,
  ManufacturerApplicationFormValues,
} from "../../types";
import { ManufacturerApplicationForm } from "./ManufacturerApplicationForm";
import { ManufacturerStatusPanel } from "./ManufacturerStatusPanel";
import { ManufacturerCompanyProfileForm } from "./ManufacturerCompanyProfileForm";

interface ManufacturerWorkspaceProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
}

export function ManufacturerWorkspace({ user, authMode }: ManufacturerWorkspaceProps) {
  const [application, setApplication] = useState<ManufacturerApplication | null>(null);
  const [isActiveAccount, setIsActiveAccount] = useState(authMode === "demo");
  const [values, setValues] = useState<ManufacturerApplicationFormValues>(() =>
    emptyManufacturerApplicationForm(user.email)
  );
  const [profileValues, setProfileValues] = useState<ManufacturerCompanyProfileValues | null>(null);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const loadGeneration = useRef(0);
  const saveGeneration = useRef(0);

  useEffect(() => {
    let isMounted = true;
    const request = ++loadGeneration.current;

    async function loadApplication() {
      setIsLoading(true);
      setErrors([]);

      try {
        const ownAccount = await fetchOwnManufacturerAccount();
        if (!isMounted || request !== loadGeneration.current) return;
        if (ownAccount.profile_id !== user.id) throw new Error("Manufacturer identity changed. Please try again.");
        const existingApplication = ownAccount.manufacturer;
        setIsActiveAccount(ownAccount.profile_status === "active");
        setApplication(existingApplication);
        setProfileValues(existingApplication?.application_status === "approved" ? companyProfileFromApplication(existingApplication) : null);
        setValues(
          existingApplication
            ? formFromApplication(existingApplication)
            : emptyManufacturerApplicationForm(user.email)
        );
      } catch (error) {
        if (isMounted && request === loadGeneration.current) {
          setErrors([error instanceof Error ? error.message : "Unable to load application."]);
        }
      } finally {
        if (isMounted && request === loadGeneration.current) setIsLoading(false);
      }
    }

    if (authMode === "demo") {
      setIsActiveAccount(true);
      setValues(emptyManufacturerApplicationForm(user.email));
      setIsLoading(false);
      return;
    }

    void loadApplication();

    return () => {
      isMounted = false;
      loadGeneration.current += 1;
      saveGeneration.current += 1;
    };
  }, [authMode, user.email, user.id]);

  function updateField(field: keyof ManufacturerApplicationFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function updateProfileField(field: keyof ManufacturerCompanyProfileValues, value: string) {
    setProfileValues((current) => current ? { ...current, [field]: value } : current);
  }

  const isEditable = isActiveAccount && (!application || manufacturerEditableStatuses.includes(application.application_status));
  const canSubmit = isEditable;

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

      const savedApplication = await saveManufacturerApplication(values, isSubmit);

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

  async function saveCompanyProfile() {
    if (!profileValues) return;
    const validationErrors = validateManufacturerCompanyProfile(profileValues);
    setErrors(validationErrors);
    setMessage(null);
    if (validationErrors.length) return;
    const request = ++saveGeneration.current;
    setIsSaving(true);
    try {
      const saved = await updateManufacturerCompanyProfile(profileValues);
      if (request !== saveGeneration.current) return;
      setApplication(saved);
      setProfileValues(companyProfileFromApplication(saved));
      setMessage("Company profile updated.");
    } catch (error) {
      if (request === saveGeneration.current) setErrors([error instanceof Error ? error.message : "Unable to save company profile."]);
    } finally {
      if (request === saveGeneration.current) setIsSaving(false);
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
        <p className="eyebrow">{application?.application_status === "approved" ? "Manufacturer Account" : "Manufacturer Onboarding"}</p>
        <h2>{application?.application_status === "approved" ? "Company Profile & Account" : "Company profile"}</h2>
        {!isActiveAccount && <p className="form-notice" role="status">Company editing requires an active Manufacturer account.</p>}
        {editableMessage() && <p className="form-notice">{editableMessage()}</p>}
        {isLoading ? (
          <LoadingState message="Loading manufacturer application..." />
        ) : application?.application_status === "approved" && profileValues ? (
          <ManufacturerCompanyProfileForm application={application} user={user} values={profileValues} disabled={!isActiveAccount || isSaving} accountStatus={isActiveAccount ? "Active" : "Inactive"} onFieldChange={updateProfileField} />
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
          {application?.application_status === "approved" && profileValues && isActiveAccount && (
            <button type="button" disabled={isSaving || isLoading} onClick={() => void saveCompanyProfile()}>{isSaving ? "Saving..." : "Save Company Profile"}</button>
          )}
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
