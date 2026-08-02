# Local Environment Safety

## Policy

PrefabHome local development, tests, CI, preview, and browser smoke are isolated
from the production Supabase project. Vite uses `config/vite-env` as its
environment directory and does not load repository-root `.env`, `.env.local`,
`.env.development`, or `.env.production` files.

The runtime also rejects the known production Supabase project whenever
`VITE_DEPLOYMENT_ENV` is `local`, `test`, `ci`, `development`, or `preview`.
The rejection happens before the Supabase client is created and returns a
generic configuration message that contains no URL, project reference, key, or
token.

## Local QA

Use:

```text
npm run dev:safe
```

The launcher removes every inherited `VITE_` variable, sets an explicit local
mode, and enables only the local demo fallback. `npm run dev` uses the same safe
launcher. The local page release metadata reports `local` and
`local-development`; Vite's startup output reports `development` mode when
debug logging is enabled with `npm run dev:safe -- --debug`.

Run `npm run quality:browser` for browser QA. It creates a fresh test artifact
with non-connecting placeholders, blocks all non-loopback page requests before
network dispatch, and fails with a sanitized hostname if external traffic is
attempted.

## Environment Files

- Never use `.env.production` for local browser testing.
- Do not retain real production browser configuration anywhere in the working
  repository. Remove it or move it to the approved deployment system before
  local QA.
- Approved production browser variables belong in the hosting provider or CI
  protected environment, not in a repository file.
- Service-role keys, database passwords, provider secrets, and test-account
  credentials must never use a `VITE_` prefix.
- `.env.example` is documentation only. Vite does not load it.

To audit a workspace, run `git status --ignored --short`, remove or rename any
local production environment file, then run `npm run verify:beta:secrets`.

## Production-shaped Verification

`npm run verify:production-readiness` accepts reviewed, explicitly injected
`example.invalid` placeholders for local artifact verification. Its dedicated
`build:production` step validates production configuration shape without
contacting Supabase, publishing files, or deploying anything.
