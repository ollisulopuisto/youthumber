# Work log

## 2026-11-21: Free-only security pilot

Review: Instinct, branch `agent/security-pilot-free`, isolated security-pilot worktree. Adds report-only, pinned scanners and weekly staggered public-hosted runs. See `docs/security-pilot.md` for coverage, output and limits. No app behavior/version change, fixes, releases, private CI, or merges.

Security pilot review follow-up: include merge-resolution patches, tolerate null RustSec advisory warnings, fix native Go scan tags, and conform to repository lint. Added two regressions (both failed against the old implementation). CodeQL pin resolves in hosted CI; no change based solely on an external 404 claim.


## Security advisory fixes, 2026-11-21

Branch: `agent/security-advisory-fixes`. Owner: Instinct. Status: Review pending.

Refresh the lockfile to remove the five npm advisory records without changing application code or direct dependency ranges. ESLint and its maintained parser dependency graph supply the patched minimatch. No merge or release is requested.


<details><summary>Verification and limits</summary>

- npm audit --package-lock-only: five moderate affected packages before, zero after, using npm 12.2.3. No force or app-facing major bump. The maintained ESLint update includes minimatch 10 to 11 internally, rather than overriding ESLint internals.
- Clean install with npm 12.2.3 passes. Devin correctly identified a new npm 10 lock validation failure from the optional TypeScript 7.1 peer. Regenerated with npm 10; npm 10 dry-run validation now passes.
- Lint passes with 19 warnings; typecheck and production build pass. The full Vitest run exceeded a 35-second local limit, not a pass; hosted CI remains the completion check.
- No Python dependencies, scanner-pilot files, native packaging, releases or visuals changed. Native Mac/desktop and optional AI inference were not tested.
- Own review: inspected all lock changes and confirmed direct dependency ranges unchanged. Devin review requested separately.

</details>
