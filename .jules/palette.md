# Palette journal

## 2026-11-01 - ElementPickerModal Escape dismissal and focus restoration
**Learning:** Dialogs rendered in conditional React trees (`role="dialog"`) must manage initial focus, `Escape` key dismissal, and opener focus return to prevent trapping keyboard-only users (WCAG 2.1.2).
**Action:** Ensure all modal dialogs capture `document.activeElement` on mount, transfer initial focus to the close action with visible focus styling (`focus-visible:outline-amber-500`), listen for `Escape` key events, and return focus to the trigger on unmount.

## 2026-11-01 - LayersPanel keyboard operability
- Finding: layer rows were `<div onClick>` only - no role, no tab stop, no keyboard activation. A keyboard-only user could not select a layer at all (WCAG 2.1.1).
- Evidence: executed jsdom repro (3 desired-behavior assertions failed on pre-fix code, control passed) + inspected before/after screenshots of the real rendered panel.
- Fix: listbox/option semantics, tabIndex, Enter/Space activation, focus-visible outline. Regression test `src/test/layersPanelKeyboard.test.jsx` kept permanently.
