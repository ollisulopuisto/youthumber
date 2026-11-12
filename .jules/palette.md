# Palette journal

## 2026-11-01 - ElementPickerModal Escape dismissal and focus restoration
**Learning:** Dialogs rendered in conditional React trees (`role="dialog"`) must manage initial focus, `Escape` key dismissal, and opener focus return to prevent trapping keyboard-only users (WCAG 2.1.2).
**Action:** Ensure all modal dialogs capture `document.activeElement` on mount, transfer initial focus to the close action with visible focus styling (`focus-visible:outline-amber-500`), listen for `Escape` key events, and return focus to the trigger on unmount.

## 2026-11-01 - LayersPanel keyboard operability
- Finding: layer rows were `<div onClick>` only - no role, no tab stop, no keyboard activation. A keyboard-only user could not select a layer at all (WCAG 2.1.1).
- Evidence: executed jsdom repro (3 desired-behavior assertions failed on pre-fix code, control passed) + inspected before/after screenshots of the real rendered panel.
- Fix: listbox/option semantics, tabIndex, Enter/Space activation, focus-visible outline. Regression test `src/test/layersPanelKeyboard.test.jsx` kept permanently.

## 2026-11-07 - Accessible names and focus outlines for destructive modal list actions
**Learning:** Icon-only destructive buttons (e.g. `🗑` delete actions) rendered inside modal item lists lack discernible names for screen reader users when only `title` is set without `aria-label`, and lose visibility during keyboard navigation when `focus-visible` styling is missing (WCAG 4.1.2, WCAG 2.4.7).
**Action:** Always provide explicit contextual `aria-label`s (e.g. `aria-label={`Delete ${item.name}`}`) and standard `focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500` rings on icon-only action buttons across list modals like `ProjectGalleryModal` and `ShowPresetModal`.

## 2026-11-10 - Focus indicators for FontPicker option and weight buttons
**Learning:** Custom listbox options and segmented button groups within property panels can easily be navigated via keyboard tabs, but without `focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500` the current focus position is completely invisible against dark container backgrounds (WCAG 2.4.7).
**Action:** Consistently equip all listbox item buttons and segmented weight/mode button groups with `focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500` so keyboard navigation preserves clear visual indicators without adding distracting focus outlines on mouse clicks.

## 2026-11-12 - Top-level toolbar button keyboard focus indicators
**Learning:** High-frequency top-level action buttons (speaker count, undo/redo, save/export, shortcuts) across dark header toolbars lose visual focus indication during keyboard tabbing unless explicitly styled with `focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500` (WCAG 2.4.7).
**Action:** Always verify that top-level header and toolbar button controls receive standard `focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500` outlines so keyboard navigation across primary workflow actions remains clearly trackable.
