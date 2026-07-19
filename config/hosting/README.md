# Hosting Templates

These files are review examples, not active provider configuration.

- `generic-spa-fallback.example` defines the required routing order.
- `cloudflare-pages-spa.example` records Pages-specific SPA and redirect cautions without adding a catch-all rule.
- `netlify-spa._redirects.example` illustrates a final fallback rule for hosts with existing-file shadowing.

Before adapting a template, verify current provider behavior, preserve real asset 404s, apply the security-header policy, and complete `docs/PRODUCTION_RELEASE_CHECKLIST.md`.

No provider is selected or connected by these examples.
