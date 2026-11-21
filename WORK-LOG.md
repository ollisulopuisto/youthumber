# Work log

## 2026-11-21: offline action transport

Branch: `feat/offline-action-stdin`. Scope: the agent/CLI automation roadmap,
limited to the already-existing project action engine. No GUI, HTTP listener,
remote provider, image rendering or job system changes.

Added process-level regressions before the implementation: stdin continuation,
long inline input, invalid shapes, size/action limits, mode conflicts and catalog
parity. Initial run: 23 failed, 1 passed. The old CLI already supported discovery
and file/inline actions, so this work does not claim a new action engine or full
roadmap completion. Version metadata is aligned for a fresh release.

Own adversarial review found two further failure paths: numeric exponent overflow
in action parameters and escaped lone Unicode surrogates during stdout encoding.
Added failing process regressions for both, then fixed error handling/serialization.
Full Python 3.13 suite before those additions: 194 passed, 16 platform skips.
Ruff lint and format checks passed. Mac runtime, GUI and packaged DMG not run here.

Independent pre-push review confirmed the overflow/output-encoding issues already
fixed, and found stdin still depended on locale. A new process test reproduced it
under PYTHONIOENCODING=ascii; stdin now reads bounded UTF-8 bytes. Added exact
1 MiB/100-action acceptance, invalid file/inline JSON, and late-step-failure tests.
Clarified parameter aliases, explicit null handling, and argparse usage errors.

Devin found bracket-prefixed relative filenames regressed. Added two failing
process tests, then restored existing-file precedence with an ENAMETOOLONG-only
fallback for long inline JSON. All file reads remain bounded.

## 2026-11-21: further review follow-up

Three process regressions reproduced the pasted findings: early-closed stdout,
process-substitution paths, and continuation of an embedded-photo project above
1 MiB. Fixed all three. Input remains finite at 64 MiB; exactly-limit input is
tested. FIFO/process-substitution paths use the same bounded byte reader.
Full Python 3.13 suite: 206 passed, 16 platform skips. Frontend: 396 tests passed,
lint, typecheck and production build passed. Local Chrome editor smoke checked
landscape/portrait canvas, headline edit, layout selection, save/reload, JPG
1920x1080 and PNG 1280x720 exports. Screenshots and exported pixels inspected.
This was not the entire CONTRIBUTING interactive matrix: native Mac webview,
all image-upload routes, shortcut actions, all browsers, model downloads and
packaged DMG were not verified. No full-GUI coverage claim is made.

Devin follow-up: a directory named like inline JSON could shadow the batch.
Added a failing process test, then limited path precedence to regular files and
FIFOs using one stat call. Existing file, process-substitution and long-inline
regressions remain in the suite.

Devin Windows follow-up: reproduced WinError 123 filename probe rejecting valid
inline JSON. Only that Windows error now falls through; permission errors still
fail closed. Two new tests, full suite 209 passed and 16 platform skips.

App-only Devin note recovered: the early-closed-pipe regression left a closed
stdout handle attached when calling communicate. Windows starts reader threads
for non-None handles, unlike the POSIX implementation. Detach the intentionally
closed pipe before communicate; preserve the exit-code and empty-stderr checks.
This changes the test harness only. Native Windows execution not available here.
Full GUI matrix remains incomplete; the prior Chromium smoke is not a substitute.

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

Main sync: preserved both independent WORK-LOG.md additions on conflict; retained
main's merged package-lock dependency security update and security-pilot files.
No main feature or dependency change was dropped. Fresh CI and Devin required.
