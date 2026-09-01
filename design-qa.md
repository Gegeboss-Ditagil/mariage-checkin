# Design QA — v1.29.2

- Source visual truth: `Photo 1.jpg` (dashboard/navigation mobile) and `Photo 2.jpg` (Canva chronogram), supplied in the conversation.
- Implementation screenshot: unavailable; the protected local routes redirect to login without a test session, and `/scan` additionally requires a real camera permission/device stream.
- Viewports requested: iPhone portrait, Android portrait, iPad/landscape, desktop.
- Source dimensions: Photo 1 = 556 × 1280 px; Photo 2 = 590 × 1280 px.
- CSS viewport/density normalization: not available because an authenticated rendered capture could not be obtained.
- State: admin/directeur authenticated dashboard, agenda, scan/photo, approval modal and capacity-reorganization states.

## Full-view comparison evidence

Blocked before visual comparison: the implementation cannot be rendered in the required authenticated state from the local preview without entering a real account PIN. Source images were inspected, but a source-only review is not a valid comparison.

## Focused region comparison evidence

Not performed for the same blocker. The intended focused regions were the five-button bottom navigation, the enlarged scan progress strip, and the first agenda timeline cards.

## Findings

- No code-level P0/P1 issue found. TypeScript, all 135 automated tests, responsive shell assertions and the production build pass.
- Visual fidelity remains unverified on a real authenticated iPhone/iPad/browser session. This is a verification gap, not a known visual defect.

## Comparison history

- Initial pass: blocked before capture; no authenticated local session and no local camera stream were available.

## Implementation checklist

- Verify admin navigation exposes Scan and Agenda.
- Verify directeur navigation exposes Agenda and keeps Bord central outside `/scan`.
- Verify the central control on `/scan` captures a live frame for admin/directeur/placeur.
- Verify 84 px navigation height and 72 px stats strip on iPhone, Android, iPad landscape and desktop.
- Verify an approval card opens a large contained photo and remains operable by touch, keyboard and Escape.
- Verify a full target table clearly disables arrived occupants, shows confirmation/arrival state and prevents assignment until enough movable places and a capable destination are selected.
- Verify the admin dashboard bottom bar reads Recherche, Plan, central Scan, Agenda, Approbations; on every other admin page, Approbations is absent from the bottom bar and remains visible with its badge in the account menu.

final result: blocked
