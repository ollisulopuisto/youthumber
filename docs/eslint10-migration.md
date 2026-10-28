# ESLint 10 / React 19 migration

User chose the broader migration on 2026-10-28: migrate the app rather than preserve old plugin compatibility. ESLint 10.13.0, @eslint-react 5.28.8 and React Hooks 7.1.1 install with ordinary npm ci, without force, peer overrides or legacy-peer-deps. No workflow or runtime dependency changes.

## Tooling changes

TypeScript changes from 7.0.2 to 6.0.3 because the maintained React plugin's typescript-eslint parser requires >=4.8.4 <6.1.0. TypeScript 7 produces a ts-api-utils runtime crash. Typechecking and production build pass with the supported parser/tooling combination.

The maintained React recommended preset replaces the old React preset; the Hooks 7 recommended preset adds the compiler-era checks. Duplicate unified-plugin Hooks rules are switched off only where the matching react-hooks rule is enabled, avoiding duplicate reports, not removing coverage. Previously error-level comment-text, children-prop and unknown-property checks remain error-level. Missing component display names remain checked.

This is deliberately not semantic parity. Old jsx-no-duplicate-props, no-is-mounted, no-string-refs, no-unescaped-entities and require-render-return have no direct mapped check; no-deprecated becomes specific modern lifecycle/DOM checks. Those legacy constraints are retired with this migration, not claimed to be covered. Undefined JSX references and unused JSX variables are handled by ESLint 10 itself. Existing disabled prop-types, jsx-no-target-blank and old React-in-scope requirements stay absent.

## Component changes

- Gallery and show-preset initial loads set state from async completion and ignore unmounted results.
- Toolbar remover list uses lazy state initialization instead of a synchronous effect update.
- Texture picker checks availability asynchronously without resetting already initialized state on mount.
- Undo/redo availability is render state, not reads from mutable history refs during render. Immediate getValue and grouped edits stay intact.
- Selection toolbar measures viewport in layout effect, not during render.
- Canvas takes ref as a React 19 prop, refreshes listener refs in layout effects and declares synchronization helpers before their use.

No lint error was suppressed to complete those changes. Twenty warnings remain, including existing dependency-array warnings and new index-key/ref-naming/refresh warnings. They are not described as zero findings.

## Validation

- Clean npm ci, typecheck, 253 tests and production build pass on Node 22.
- Lint: zero errors, twenty warnings. Seven synthetic checks prove representative lint rules actually fire.
- New rendered hook test covers grouped edits, undo/redo availability and branching. It also passes against the prior implementation, so it is a preservation test, not a newly discovered bug reproduction.
- New Hooks preset exposed real lint errors before component edits, including render-time ref access and effect initialization. The complete migrated app now clears those errors.
- Chromium smoke: editor and Fabric canvas render without page errors, editing headline + undo/redo works, four-speaker selection and export invoke the imperative canvas ref, and show modal opens. Static preview has no Python API, so saved-show fetch reports unavailable there. Real native backend/CoreML/background removal and packaged Mac launch remain unverified, not inferred from frontend success.

Browser interaction also exposed a pre-existing incomplete Fabric 7 port: removed getPointer and the old bare-object findTarget contract. Target preference now uses scene/viewport points and preserves Fabric 7 target-info shape; context-menu extraction follows that contract. Two dedicated tests cover active hit and miss. The interactive exception occurred before the repair and disappears after it.

The user requested the headline cutout fix in this same PR. A plain Fabric IText with loaded Montserrat reproduces the cuts when its black stroke is painted after the fill; the same font is clean when stroke is painted first. EffectText now defaults to paintFirst=stroke, preserving explicit caller overrides. The constructor regression fails before the change and passes after. Actual editor JPEG exports were inspected before and after: clean filled letters, outline behind the face, shadow preserved. No font substitution or removal of outline.
