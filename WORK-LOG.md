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
