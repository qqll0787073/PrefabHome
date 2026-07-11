import { useEffect, useMemo, useState, type FormEvent } from "react";
import { messages, products, quoteRequests } from "./data";
import { useAuth, type AuthCredentials, type AuthUser } from "./lib/auth";
import {
  adminReviewStatuses,
  createManufacturerApplication,
  emptyManufacturerApplicationForm,
  fetchManufacturerApplications,
  fetchOwnManufacturerApplication,
  formFromApplication,
  manufacturerEditableStatuses,
  manufacturerSubmittableStatuses,
  reviewManufacturerApplication,
  statusLabels,
  submitManufacturerApplication,
  updateManufacturerApplication,
  validateManufacturerApplication,
} from "./lib/manufacturers";
import type {
  ManufacturerApplication,
  ManufacturerApplicationFormValues,
  ManufacturerApplicationStatus,
  Product,
  Role,
  View,
} from "./types";

const roleLabels: Record<Role, string> = {
  buyer: "Buyer Portal",
  manufacturer: "Manufacturer Portal",
  admin: "Admin Portal",
};

const viewLabels: Record<View, string> = {
  browse: "Browse",
  compare: "Compare",
  advisor: "AI Advisor",
  "import-center": "Import Center",
  dashboard: "Dashboard",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function App() {
  const auth = useAuth();
  const [role, setRole] = useState<Role>("buyer");
  const [view, setView] = useState<View>("browse");
  const [query, setQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0]);
  const [saved, setSaved] = useState<string[]>(["house-20-fold"]);
  const [compare, setCompare] = useState<string[]>(["house-20-fold", "house-40-container"]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter((product) =>
      [product.name, product.category, product.manufacturer, product.description]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query]);

  const comparedProducts = products.filter((product) => compare.includes(product.id));

  function toggleSaved(productId: string) {
    setSaved((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId]
    );
  }

  function toggleCompare(productId: string) {
    setCompare((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : current.length >= 4
          ? current
          : [...current, productId]
    );
  }

  const hasPortalAccess = Boolean(auth.user && auth.user.role === role);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">China Factories x U.S. Buyers</p>
          <h1>PrefabHome Marketplace</h1>
        </div>
        <div className="role-switcher" aria-label="Portal role">
          {(Object.keys(roleLabels) as Role[]).map((item) => (
            <button
              key={item}
              className={role === item ? "active" : ""}
              onClick={() => {
                setRole(item);
                setView("dashboard");
              }}
            >
              {roleLabels[item]}
            </button>
          ))}
        </div>
        <div className="auth-summary">
          {auth.user ? (
            <>
              <span>{auth.user.fullName}</span>
              <small>{roleLabels[auth.user.role]}</small>
              <button onClick={() => void auth.logout()}>Logout</button>
            </>
          ) : (
            <>
              <span>{auth.mode === "supabase" ? "Supabase Auth" : "Demo Auth"}</span>
              <small>{auth.isLoading ? "Checking session" : "Not signed in"}</small>
            </>
          )}
        </div>
      </header>

      <nav className="nav-tabs" aria-label="Primary">
        {(Object.keys(viewLabels) as View[]).map((item) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            onClick={() => setView(item)}
          >
            {viewLabels[item]}
          </button>
        ))}
      </nav>

      <main>
        {view === "browse" && (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow badge">Direct Cross-Border Marketplace</p>
                <h2>Buy Chinese prefab modular homes directly</h2>
                <p>
                  Browse verified factory listings, compare models, request quotes, and prepare
                  import, customs, and local permit review in one workflow.
                </p>
              </div>
              <div className="search-panel">
                <label htmlFor="listing-search">Search models</label>
                <input
                  id="listing-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search models, materials, categories..."
                />
                <button onClick={() => setView("advisor")}>Ask AI Advisor</button>
              </div>
            </section>

            <section className="content-grid">
              <aside className="filters">
                <h3>Filters</h3>
                <button>All Products</button>
                <button>ADU</button>
                <button>Tiny House</button>
                <button>Container House</button>
                <label>
                  <input type="checkbox" /> Customizable only
                </label>
                <label>
                  <input type="checkbox" /> Off-grid compatible
                </label>
              </aside>
              <div className="product-grid">
                {filteredProducts.map((product) => (
                  <article className="product-card" key={product.id}>
                    <img src={product.imageUrl} alt={product.name} />
                    <div className="product-body">
                      <p className="eyebrow">{product.category}</p>
                      <h3>{product.name}</h3>
                      <p>{product.description}</p>
                      <div className="meta-row">
                        <span>{formatCurrency(product.price)}</span>
                        <span>{product.sizeSqFt} sq ft</span>
                        <span>{product.leadTimeWeeks} weeks</span>
                      </div>
                      <div className="tag-row">
                        {product.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      <div className="actions">
                        <button onClick={() => setSelectedProduct(product)}>Details</button>
                        <button onClick={() => toggleSaved(product.id)}>
                          {saved.includes(product.id) ? "Saved" : "Save"}
                        </button>
                        <button onClick={() => toggleCompare(product.id)}>
                          {compare.includes(product.id) ? "Comparing" : "Compare"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        {view === "compare" && (
          <section className="panel">
            <h2>Compare Models</h2>
            <div className="comparison-table">
              {comparedProducts.map((product) => (
                <article key={product.id}>
                  <h3>{product.name}</h3>
                  <p>{formatCurrency(product.price)}</p>
                  <p>{product.sizeSqFt} sq ft</p>
                  <p>{product.leadTimeWeeks} week lead time</p>
                  <button onClick={() => toggleCompare(product.id)}>Remove</button>
                </article>
              ))}
            </div>
          </section>
        )}

        {view === "advisor" && (
          <section className="panel advisor">
            <p className="eyebrow">AI Home Advisor</p>
            <h2>Zoning, model fit, and import planning assistant</h2>
            <p>
              Production will call a server-side AI endpoint. API keys stay on the server; the
              browser sends only buyer questions and selected listing context.
            </p>
            <textarea placeholder="Describe your lot, budget, intended use, and state..." />
            <button>Generate Planning Checklist</button>
          </section>
        )}

        {view === "import-center" && (
          <section className="panel">
            <p className="eyebrow">Import & Customs Document Center</p>
            <h2>Document readiness</h2>
            <div className="document-list">
              {["Commercial invoice", "Packing list", "Bill of lading", "Material certificates"].map(
                (item) => (
                  <label key={item}>
                    <input type="checkbox" /> {item}
                  </label>
                )
              )}
            </div>
          </section>
        )}

        {view === "dashboard" && (
          <>
            {!auth.user && (
              <AuthPanel
                activeRole={role}
                authError={auth.error}
                authMode={auth.mode}
                isLoading={auth.isLoading}
                onLogin={auth.login}
                onRegister={auth.register}
              />
            )}

            {auth.user && !hasPortalAccess && (
              <section className="panel access-panel">
                <p className="eyebrow">Protected Portal</p>
                <h2>Role access required</h2>
                <p>
                  You are signed in as {roleLabels[auth.user.role]}. Switch back to that portal or
                  log out before entering {roleLabels[role]}.
                </p>
                <button onClick={() => setRole(auth.user?.role ?? "buyer")}>
                  Go to my portal
                </button>
              </section>
            )}

            {hasPortalAccess && (
              <>
                <section className="dashboard-grid">
                  <div className="panel">
                    <p className="eyebrow">{roleLabels[role]}</p>
                    <h2>
                      {role === "buyer"
                        ? "Buyer workspace"
                        : role === "manufacturer"
                          ? "Factory workspace"
                          : "Admin operations"}
                    </h2>
                    <p>
                      Signed in as {auth.user?.email}. Portal access is role-gated while the
                      production implementation moves data into Supabase.
                    </p>
                  </div>
                  <div className="panel">
                    <h3>Quote Requests</h3>
                    {quoteRequests.map((quote) => (
                      <div className="list-item" key={quote.id}>
                        <strong>{quote.productName}</strong>
                        <span>{quote.status}</span>
                      </div>
                    ))}
                  </div>
                  <div className="panel">
                    <h3>Messaging</h3>
                    {messages.map((message) => (
                      <div className="message" key={message.id}>
                        <strong>{message.from}</strong>
                        <p>{message.body}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {role === "manufacturer" && auth.user && (
                  <ManufacturerWorkspace user={auth.user} authMode={auth.mode} />
                )}

                {role === "admin" && auth.user && (
                  <AdminManufacturerReview authMode={auth.mode} />
                )}
              </>
            )}
          </>
        )}

        {selectedProduct && view === "browse" && (
          <aside className="details-panel">
            <button className="close-button" onClick={() => setSelectedProduct(null)}>
              Close
            </button>
            <h2>{selectedProduct.name}</h2>
            <p>{selectedProduct.manufacturer}</p>
            <p>{selectedProduct.location}</p>
            <ul>
              {selectedProduct.compliance.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <button>Request Quote</button>
          </aside>
        )}
      </main>
    </div>
  );
}

interface AuthPanelProps {
  activeRole: Role;
  authError: string | null;
  authMode: "supabase" | "demo";
  isLoading: boolean;
  onLogin: (credentials: AuthCredentials) => Promise<void>;
  onRegister: (credentials: AuthCredentials) => Promise<void>;
}

function AuthPanel({
  activeRole,
  authError,
  authMode,
  isLoading,
  onLogin,
  onRegister,
}: AuthPanelProps) {
  const [formMode, setFormMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>(activeRole);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const registrationRoles: Role[] = ["buyer", "manufacturer"];

  useEffect(() => {
    if (formMode === "register" && selectedRole === "admin") {
      setSelectedRole("buyer");
    } else if (formMode === "login") {
      setSelectedRole(activeRole);
    }
  }, [activeRole, formMode, selectedRole]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    const credentials: AuthCredentials = {
      email,
      password,
      fullName,
      role: selectedRole,
    };

    try {
      if (formMode === "login") {
        await onLogin(credentials);
      } else {
        await onRegister(credentials);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel">
      <div>
        <p className="eyebrow">{authMode === "supabase" ? "Supabase Auth" : "Demo Auth"}</p>
        <h2>{formMode === "login" ? "Sign in to continue" : "Create a portal account"}</h2>
        <p>
          Buyer and manufacturer registration is ready for Supabase. Admin access is supported as
          a role, but should be granted through an operator-controlled process.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="segmented-control">
          <button
            type="button"
            className={formMode === "login" ? "active" : ""}
            onClick={() => setFormMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={formMode === "register" ? "active" : ""}
            onClick={() => setFormMode("register")}
          >
            Register
          </button>
        </div>

        {formMode === "register" && (
          <label>
            Full name
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jane Smith"
              required
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>

        <label>
          Portal role
          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as Role)}
          >
            {(formMode === "register" ? registrationRoles : (Object.keys(roleLabels) as Role[])).map(
              (item) => (
                <option key={item} value={item}>
                  {roleLabels[item]}
                </option>
              )
            )}
          </select>
        </label>

        {authError && <p className="form-error">{authError}</p>}

        <button type="submit" disabled={isLoading || isSubmitting}>
          {isSubmitting ? "Working..." : formMode === "login" ? "Login" : "Register"}
        </button>
      </form>
    </section>
  );
}

interface ManufacturerWorkspaceProps {
  user: AuthUser;
  authMode: "supabase" | "demo";
}

function ManufacturerWorkspace({ user, authMode }: ManufacturerWorkspaceProps) {
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
      <div className="panel application-status-panel">
        <div>
          <p className="eyebrow">Manufacturer Application Status</p>
          <h2>{application ? statusLabels[application.application_status] : "Not started"}</h2>
          <p>
            {application
              ? application.review_notes || "Your application is available for review tracking."
              : "Complete the onboarding form to create your manufacturer application."}
          </p>
        </div>
        {application && (
          <dl className="status-list">
            <div>
              <dt>Submitted</dt>
              <dd>{formatDate(application.submitted_at)}</dd>
            </div>
            <div>
              <dt>Reviewed</dt>
              <dd>{formatDate(application.reviewed_at)}</dd>
            </div>
            <div>
              <dt>Products</dt>
              <dd>
                {application.application_status === "approved"
                  ? "Product creation enabled"
                  : "Product creation locked"}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <section className="panel">
        <p className="eyebrow">Manufacturer Onboarding</p>
        <h2>Company profile</h2>
        {editableMessage() && <p className="form-notice">{editableMessage()}</p>}
        {isLoading ? (
          <p>Loading manufacturer application...</p>
        ) : (
          <form className="application-form">
            <label>
              Company legal name
              <input
                value={values.companyLegalName}
                onChange={(event) => updateField("companyLegalName", event.target.value)}
                disabled={!isEditable}
                required
              />
            </label>
            <label>
              Company display name
              <input
                value={values.companyDisplayName}
                onChange={(event) => updateField("companyDisplayName", event.target.value)}
                disabled={!isEditable}
                required
              />
            </label>
            <label>
              Contact person
              <input
                value={values.contactPerson}
                onChange={(event) => updateField("contactPerson", event.target.value)}
                disabled={!isEditable}
                required
              />
            </label>
            <label>
              Contact title
              <input
                value={values.contactTitle}
                onChange={(event) => updateField("contactTitle", event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                disabled={!isEditable}
                required
              />
            </label>
            <label>
              Phone
              <input
                value={values.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              Website
              <input
                type="url"
                value={values.website}
                onChange={(event) => updateField("website", event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              Country
              <input
                value={values.country}
                onChange={(event) => updateField("country", event.target.value)}
                disabled={!isEditable}
                required
              />
            </label>
            <label>
              Province/state
              <input
                value={values.province}
                onChange={(event) => updateField("province", event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              City
              <input
                value={values.city}
                onChange={(event) => updateField("city", event.target.value)}
                disabled={!isEditable}
                required
              />
            </label>
            <label>
              Street address
              <input
                value={values.streetAddress}
                onChange={(event) => updateField("streetAddress", event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              Postal code
              <input
                value={values.postalCode}
                onChange={(event) => updateField("postalCode", event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              Year established
              <input
                inputMode="numeric"
                value={values.yearEstablished}
                onChange={(event) => updateField("yearEstablished", event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              Export experience
              <input
                value={values.exportExperience}
                onChange={(event) => updateField("exportExperience", event.target.value)}
                disabled={!isEditable}
              />
            </label>
            <label>
              Product categories
              <input
                value={values.productCategories}
                onChange={(event) => updateField("productCategories", event.target.value)}
                placeholder="ADU, tiny house, container house"
                disabled={!isEditable}
                required
              />
            </label>
            <label>
              Certifications
              <input
                value={values.certifications}
                onChange={(event) => updateField("certifications", event.target.value)}
                placeholder="ISO 9001, CE, CSA"
                disabled={!isEditable}
              />
            </label>
            <label className="full-width">
              Company description
              <textarea
                value={values.companyDescription}
                onChange={(event) => updateField("companyDescription", event.target.value)}
                disabled={!isEditable}
                required
              />
            </label>
          </form>
        )}

        {errors.length > 0 && (
          <div className="form-error" role="alert">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
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

interface AdminManufacturerReviewProps {
  authMode: "supabase" | "demo";
}

function AdminManufacturerReview({ authMode }: AdminManufacturerReviewProps) {
  const [applications, setApplications] = useState<ManufacturerApplication[]>([]);
  const [isLoading, setIsLoading] = useState(authMode === "supabase");
  const [error, setError] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [isReviewing, setIsReviewing] = useState<string | null>(null);

  async function loadApplications() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchManufacturerApplications();
      setApplications(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load applications.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (authMode === "demo") {
      setApplications([]);
      setIsLoading(false);
      return;
    }

    void loadApplications();
  }, [authMode]);

  async function applyReview(
    application: ManufacturerApplication,
    status: ManufacturerApplicationStatus
  ) {
    setIsReviewing(`${application.id}:${status}`);
    setError(null);

    try {
      const updated = await reviewManufacturerApplication(
        application.id,
        status,
        reviewNotes[application.id] ?? application.review_notes ?? ""
      );
      setApplications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Unable to review application.");
    } finally {
      setIsReviewing(null);
    }
  }

  return (
    <section className="workspace-section">
      <section className="panel">
        <p className="eyebrow">Admin Manufacturer Review</p>
        <h2>Application queue</h2>
        {error && <p className="form-error">{error}</p>}
        {isLoading && <p>Loading manufacturer applications...</p>}
        {!isLoading && applications.length === 0 && (
          <p>
            {authMode === "demo"
              ? "Demo mode has no shared manufacturer applications."
              : "No manufacturer applications are waiting for review."}
          </p>
        )}
        <div className="review-list">
          {applications.map((application) => (
            <article className="review-item" key={application.id}>
              <div>
                <p className="eyebrow">{statusLabels[application.application_status]}</p>
                <h3>{application.company_display_name ?? application.company_name}</h3>
                <p>{application.company_description || "No company description provided."}</p>
                <dl className="status-list compact">
                  <div>
                    <dt>Contact</dt>
                    <dd>{application.contact_person ?? "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>
                      {[application.city, application.province, application.country]
                        .filter(Boolean)
                        .join(", ")}
                    </dd>
                  </div>
                  <div>
                    <dt>Categories</dt>
                    <dd>{application.product_categories.join(", ") || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatDate(application.submitted_at)}</dd>
                  </div>
                </dl>
              </div>
              <label className="review-notes">
                Review notes
                <textarea
                  value={reviewNotes[application.id] ?? application.review_notes ?? ""}
                  onChange={(event) =>
                    setReviewNotes((current) => ({
                      ...current,
                      [application.id]: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="actions">
                {adminReviewStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={Boolean(isReviewing)}
                    onClick={() => void applyReview(application, status)}
                  >
                    {isReviewing === `${application.id}:${status}`
                      ? "Saving..."
                      : status === "draft"
                        ? "Return for Revision"
                        : statusLabels[status]}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default App;
