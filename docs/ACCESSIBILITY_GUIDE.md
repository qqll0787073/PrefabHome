# Accessibility Guide

## Objective

PrefabHome targets WCAG 2.2 AA as an engineering objective. This is not an accessibility certification or legal-compliance claim.

## Keyboard And Focus

- Every interactive action must use a native link, button, input, select, or textarea unless an established accessible widget pattern is implemented.
- Positive tabindex values are prohibited.
- Focus indicators must remain visible in standard and forced-colors modes.
- Public client-side navigation moves focus to the new main content without forcing scroll.
- Dialogs must receive initial focus, contain Tab focus, close with Escape when safe, and restore focus to the invoking control.
- Sticky or fixed regions must not obscure focused content.

## Landmarks And Headings

- Top-level public and portal shells expose a header, labelled navigation, one primary main target, and a skip link.
- Public pages include a footer and exactly one page-level `h1`.
- Headings communicate structure and must not be chosen for visual size alone.

## Forms And Errors

- Labels must be programmatically associated with controls.
- Required state uses native `required` where applicable and explanatory text where business requirements are conditional.
- Invalid controls use `aria-invalid` when an error is known.
- Error text is associated through `aria-describedby` or an equivalent field-specific relationship.
- Error summaries and status updates use restrained live-region behavior and must not announce the same message repeatedly.
- Credential fields use appropriate autocomplete tokens and credentials must never be logged.

## Status And Loading

- Loading messages use `role="status"` or an appropriate polite live region.
- Busy forms and result regions expose `aria-busy` and disable duplicate submission controls.
- Loading states use meaningful finite text and preserve stable dimensions where possible.
- Runtime failures remain within `AppErrorBoundary` and expose safe retry/reload controls without raw stack data.

## Dialogs, Tables, Tabs, And Menus

- Dialogs require an accessible name, modal semantics when modal, initial focus, keyboard containment, Escape behavior, and focus restoration.
- Data tables require semantic headers and scopes; a caption or nearby heading must identify the data.
- Tab and menu semantics must be used only when the complete keyboard pattern is implemented. Ordinary navigation should remain links or buttons.

## Images

- Informative images require useful alt text; decorative images use empty alt text.
- Layout must reserve image space through intrinsic dimensions, aspect ratio, or stable component dimensions.
- Below-the-fold and repeated images load lazily and decode asynchronously.
- Only the likely route-level LCP image receives eager/high priority treatment.

## Motion And Contrast

- `prefers-reduced-motion` suppresses non-essential transitions and animation.
- `forced-colors` preserves control borders, current-state indication, and focus outlines.
- Information must not rely on color alone.
- Text and controls target WCAG AA contrast, but final contrast review remains manual because runtime data and platform rendering vary.

## Zoom And Reflow

- Key public and login surfaces must reflow without page-level horizontal scrolling at 200% and 400% zoom.
- Internal scrolling is acceptable for dense navigation and tables when focus remains visible and content is operable.
- Text must wrap without clipping or overlapping neighboring controls.

## Required Manual Checks

- NVDA or JAWS with Chrome/Edge on Windows
- VoiceOver with Safari on macOS/iOS
- Browser zoom at 200% and 400%, including text-only zoom where supported
- Windows High Contrast and platform forced-colors behavior
- Keyboard operation through representative Buyer, Manufacturer, and Admin workflows
- Dialog announcement, table navigation, validation recovery, text spacing, and contrast sampling
- Real-device mobile safe areas and orientation changes

Automated checks reduce regression risk; they do not replace assistive-technology testing with representative users.
