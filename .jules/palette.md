# Palette journal

## 2026-11-01 - LayersPanel keyboard operability
- Finding: layer rows were `<div onClick>` only - no role, no tab stop, no keyboard activation. A keyboard-only user could not select a layer at all (WCAG 2.1.1).
- Evidence: executed jsdom repro (3 desired-behavior assertions failed on pre-fix code, control passed) + inspected before/after screenshots of the real rendered panel.
- Fix: listbox/option semantics, tabIndex, Enter/Space activation, focus-visible outline. Regression test `src/test/layersPanelKeyboard.test.jsx` kept permanently.
