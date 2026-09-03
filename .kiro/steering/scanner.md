---
inclusion: auto
name: scanner
description: Auto-include when working on the gate scanner, QR scanning, camera capture, IN/OUT direction detection, scan cooldown, offline queue, manual name lookup, gate_id, or the /scan page.
---

# Gate scanner guidance (Module 4 of the plan)

Follow `PROJECT_PLAN.md` Module 4 and `CLAUDE_BUILD_BRIEF.md` Section 7 (Module 4) exactly.
Delivered as an installable PWA. Operated by student volunteers on a queue, often outdoors.

## Scan sequence

1. Camera reads QR → resolve token via `/qr_index` → find event + attendee. The scanner assumes NO
   fixed event; the token determines the event.
2. Reject and LOG each failure: not in index → `rejected_invalid`; revoked → `rejected_revoked`;
   not approved → `rejected_not_approved`; outside that event's window → `rejected_expired` (no time);
   same token within 5s → `rejected_cooldown`.
3. Otherwise accept: direction from current session state (no open session → `in`, open → `out`).
   Write under `/events/{eventId}/scan_events` with server timestamp.

## The 5-second cooldown is mandatory

Camera decoders fire several times per second. Without the per-token cooldown, one presentation
registers as IN then OUT and the attendee's timer silently freezes while the screen looks fine.

## Feedback (built for queue conditions)

- Full-screen color: green IN / amber OUT / red reject (readable peripherally).
- Distinct sound per outcome (colour alone excludes colour-blind operators).
- Large attendee name + initials avatar — the ONLY anti-proxy check, show it prominently.
- Direction badge, timestamp, total accumulated time, eligibility progress.
- Auto-reset to camera after 2 seconds — no tap between attendees.

## Fallbacks (each happens at a real event)

- Manual name lookup when a QR can't be read → log `method: manual_lookup`.
- Offline queue in localStorage, flush on reconnect, PRESERVE original timestamps.
- `gate_id` per device so multi-entrance venues work and scans are attributable.

## Roles

Gate staff account: scanner access only. It must not be able to read the attendee roster.
