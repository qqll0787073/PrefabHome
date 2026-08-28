import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { ManufacturerCompanyProfileForm } from "./ManufacturerCompanyProfileForm";

const application = { id:"m",owner_id:"owner",company_name:"Display",company_legal_name:"Locked Legal",company_display_name:"Display",contact_person:"Contact",contact_title:"Director",email:"private@example.test",phone:"555",website:"https://example.test",country:"Canada",province:"Ontario",city:"Toronto",street_address:"Private road",postal_code:"A1A",year_established:2001,export_experience:"Reviewed",product_categories:["ADU"],certifications:["CSA"],company_description:"Description",application_status:"approved" as const,review_notes:null,reviewed_by:null,reviewed_at:null,submitted_at:null,created_at:"2026-01-01",updated_at:"2026-01-01" };
const values = { companyDisplayName:"Display",companyDescription:"Description",website:"https://example.test",city:"Toronto",province:"Ontario",contactPerson:"Contact",contactTitle:"Director",email:"private@example.test",phone:"555",streetAddress:"Private road",postalCode:"A1A" };

test("approved profile separates public, private, reviewed, and account sections", () => {
  const html = renderToStaticMarkup(createElement(ManufacturerCompanyProfileForm,{ application,user:{id:"owner",email:"auth@example.test",fullName:"Owner",role:"manufacturer"},values,disabled:false,accountStatus:"Active",onFieldChange(){} }));
  assert.match(html,/Buyer-visible company information/);
  assert.match(html,/Private company contact and address/);
  assert.match(html,/Reviewed company details/);
  assert.match(html,/Account identity and status/);
  assert.match(html,/Locked Legal/);
  assert.match(html,/auth@example.test/);
  assert.doesNotMatch(html,/review_notes|reviewed_by|verification_status/);
});

test("inactive account disables every self-service control", () => {
  const html = renderToStaticMarkup(createElement(ManufacturerCompanyProfileForm,{ application,user:{id:"owner",email:"auth@example.test",fullName:"Owner",role:"manufacturer"},values,disabled:true,accountStatus:"Inactive",onFieldChange(){} }));
  assert.match(html,/Inactive/);
  assert.equal((html.match(/disabled=""/g) ?? []).length,11);
});
