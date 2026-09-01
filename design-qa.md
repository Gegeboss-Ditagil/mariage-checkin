# Design QA — v1.29.4

- Source visual truth: the four supplied iPhone screenshots for `/scan`, `/approbations`, the approval detail modal and `/dashboard` under `C:\Users\GersomDosGoncalves\.codex\codex-remote-attachments\019fe944-b3d3-7102-87e1-5e2258f9c5c2\1BDB6B3C-2EA9-4C01-861D-07B31225F0F4\`.
- Implementation screenshot: unavailable.
- Target viewport: iPhone portrait; responsive behavior must also remain usable on Android, iPad/landscape and desktop.
- Source pixel dimensions: Photo 1 and Photo 3/4 are portrait phone captures; Photo 2 is a focused crop. Exact CSS viewport/density normalization is unavailable.
- State: authenticated admin or visibility approver, existing pending requests, camera authorized for `/scan`.

## Full-view comparison evidence

Blocked before a valid comparison. The protected local routes require a real authenticated session, while `/scan` additionally requires a device camera stream. The source images were inspected, but no authenticated implementation capture could be produced at the same state and viewport.

## Focused region comparison evidence

Not performed because there is no implementation screenshot. The required focused regions are:

- the long Approbations shortcut immediately above the arrival progress strip;
- the account menu containing Approbations with its badge;
- the approval detail modal with previous/next controls, large photo, status and decision buttons;
- the table recommendations and relocation guardrails after approval;
- the dashboard bottom navigation with Scan present and Approbations absent.

## Findings

- [Blocked] Fonts/typography, spacing/layout rhythm, colors/tokens, image crop/quality and final copy cannot be visually compared without the authenticated implementation state.
- Source-level and automated checks cover the requested information architecture, accessibility labels, permissions, navigation, decision flow, table recommendation inputs and responsive shell.
- No new image asset is required: request photos remain the real uploaded assets and all new controls reuse the existing application icon/tokens.

## Comparison history

- Initial pass: blocked before implementation capture; no test PIN/session and no local camera stream were available.

## Implementation checklist

- Verify on a real iPhone that the Approbations shortcut sits between the camera area and progress strip without hiding either one.
- Verify a new request raises the in-app banner within five seconds and the menu badge updates.
- Verify an installed PWA receives a background push after VAPID variables are configured in Vercel.
- Verify previous/next controls stay reachable around the modal on iPhone SE and larger iPhones.
- Verify recommendations distinguish direct free space, provisional non-arrivals and reserve.
- Verify admin/visibility Back returns to Dashboard and Approbations is absent from every bottom bar.

final result: blocked
