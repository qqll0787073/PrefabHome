# Isolated Vite Environment

Vite uses this directory as its `envDir` so repository-root `.env`, `.env.local`,
`.env.development`, and `.env.production` files cannot be loaded implicitly.

Do not place credentials or real deployment configuration in this directory.
Browser variables must be injected explicitly by the safe local launcher, CI, or
an approved deployment system.
