# Account Recovery UAT Configuration

Account recovery uses Supabase Auth only. The browser calls
`resetPasswordForEmail`, recognizes the `PASSWORD_RECOVERY` Auth event, and
updates only the authenticated user's password with `updateUser`. Application
roles, profile status, and Manufacturer approval remain database-derived.

Before controlled UAT, configure the Supabase Auth URL settings to allow the
exact deployed origins and these fixed application destinations:

- `http://localhost:<approved-port>/marketplace?auth=recovery` for local UAT;
- the approved preview/UAT origin plus `/marketplace?auth=recovery`;
- the eventual production origin plus `/marketplace?auth=recovery`;

Do not use wildcard origins broader than the approved deployment domains.
Configure a production-capable custom SMTP provider before public launch;
Supabase's default sender is appropriate only for limited development testing.

UAT must verify successful delivery and callback, expired and consumed links,
provider rate limiting, password update, forced return to Login, and unchanged
Buyer/Manufacturer/Admin role and account status. Include a suspended profile
and an unapproved Manufacturer. Recovery may change their credential but must
not restore application authority.

No Staging or Production Auth configuration was changed by Sprint 5F.2.

Confirmation-email resend is deferred to post-5F.2 follow-up or controlled
UAT feedback; normal registration confirmation behavior is unchanged.
