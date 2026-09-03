---
inclusion: auto
name: admin-ui
description: Auto-include when working on the admin dashboard, event management/switcher, registration approval, event settings, corrections tool, CSV/PDF export, CertFlow export, student self-service page, or public registration form.
---

# Admin, self-service & registration guidance (Modules 0,1,2,3,5,6,7)

Follow `PROJECT_PLAN.md` Sections 7 and 10A and `CLAUDE_BUILD_BRIEF.md` Section 7 exactly.

## Module 0 — Event management + switcher (AdminHome)

Event list with status + live counts; create event; active-event switcher with a PERSISTENT banner
showing the active event (acting on the wrong event is the top admin risk). Archive is reversible.

## Module 1 — Public registration (PublicRegister, /register/:eventId)

Show event details + the stated certificate requirement. Fields: full_name, email, organization.
Consent checkbox unchecked by default. Save as `pending` with NO QR. Show the self-service link in
the confirmation. Duplicate-email detection, per-IP throttle + light CAPTCHA, honor `registration_open`.

## Module 2 — Registration mgmt (AdminRegistrations)

Approve/reject single + bulk. On approval: mint 128-bit random `qr_token`, render QR, email via
EmailJS, write `/qr_index`. Manual add (walk-ins). Bulk CSV upload with preview + per-row validation
before commit, throttled email queue. Revoke; re-issue invalidates old token.

## Module 3 — Settings (AdminSettings)

Per-event. Show total countable hours next to the minimum requirement and WARN if requirement >
countable hours. Defaults (editable): Hackathon 16h, Seminar 3h, Workshop 4h30m.

## Module 5 — Dashboard (AdminDashboard)

Stats bar (inside / registered / not-arrived / eligible / needs-review). Attendee rows with live
timer, total, eligibility or progress (`2h15m / 3h`). Paginated live scan log incl. rejections.
Corrections tool: insert missing scan / void scan / adjust minutes — each REQUIRES a written reason,
append-only, original preserved.

## Module 6 — Export (AdminExport)

Pre-export reconciliation (flag open/capped/no-exit sessions, force confirm/correct). Exports:
analytical CSV; CertFlow-ready CSV (exactly `name,email` header, eligible-only, UTF-8); PDF with
event header recording threshold + countable hours.

## Module 7 — Self-service (StudentSelfService, /me/:claimToken)

No account. My QR (guaranteed retrieval when email fails), status + progress, prominent scan-out
reminder while inside, scan history, request-review. Use ONE-TIME READS, not live listeners (quota).

## Shared

All figures are derived at read time. Live listeners only on dashboard + gate; everything else
one-time reads. Accessibility: 4.5:1 contrast, labelled inputs, keyboard nav, usable at 360px,
body text >= 16px.
