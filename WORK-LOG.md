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
