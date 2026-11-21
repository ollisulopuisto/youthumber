
## Security advisory fixes, 2026-11-21

Branch: `agent/security-advisory-fixes`. Owner: Instinct. Status: Review pending.

Refresh the lockfile to remove the five npm advisory records without changing application code or direct dependency ranges. ESLint and its maintained parser dependency graph supply the patched minimatch. No merge or release is requested.


<details><summary>Verification and limits</summary>

- npm audit --package-lock-only: five moderate affected packages before, zero after, using npm 12.2.3. No force or app-facing major bump. The maintained ESLint update includes minimatch 10 to 11 internally, rather than overriding ESLint internals.
- Clean install with npm 12.2.3 passes. Local npm 10 rejects the existing TypeScript alias graph; no assertion that npm 10 is supported.
- Lint passes with 19 warnings; typecheck and production build pass. The full Vitest run exceeded a 35-second local limit, not a pass; hosted CI remains the completion check.
- No Python dependencies, scanner-pilot files, native packaging, releases or visuals changed. Native Mac/desktop and optional AI inference were not tested.
- Own review: inspected all lock changes and confirmed direct dependency ranges unchanged. Devin review requested separately.

</details>
