# CLAUDE BUILD BRIEF — AWS SBG Event Attendance System

> **Paste this whole file into Claude.** It is self-contained. Claude does not need access to the
> repo to understand the project — everything needed to start building is below. There is a much
> longer companion doc (`PROJECT_PLAN.md`, ~800 lines) that is the source of truth for edge cases;
> this brief is the condensed, build-oriented version. When a detail here conflicts with anything,
> ask before deciding — do not guess.

---

## 0. What I want from you (Claude)

I am building a **web-based, QR-powered event attendance + certificate-eligibility system** for the
**AWS Student Builder Group, STI College Global City**. The project is scaffolded but almost nothing
is implemented yet. I want you to help me build it **incrementally, test-driven, one module at a
time**, following the plan below.

> **Context note — read this first.** This is a **software/system project built for AWS SBG Global
> City** — the system itself is the deliverable. It is **not** a hackathon entry, and it is not being
> built *for* a hackathon. The words "hackathon / seminar / workshop" appear throughout only as the
> three **event formats the system supports** (an admin picks one per event, which sets a default
> minimum-attendance requirement). Treat them as a configurable feature of the product, never as the
> project's purpose or deadline.

**Rules of engagement:**

- Do **not** dump the entire app in one response. Work module by module.
- **Time engine first** (Section 6). It is pure logic, it decides who gets a certificate, and every
  screen depends on it. Build it and its unit tests **before** any UI consumes it.
- Write **failing tests first**, then the code to pass them (TDD). Ask me to confirm before moving on.
- Keep secrets out of code (Firebase config + EmailJS keys go in `.env`, never committed).
- Match the existing stack and conventions (React function components, Tailwind, react-router).
- When something is ambiguous, ask a short clarifying question instead of assuming.

Start by telling me: (a) the build order you'd follow, (b) what testing setup you'd add (there is
none yet), and (c) the first module you'd implement. Then wait for my go-ahead.

---

## 1. Current project state (as of this brief)

**Stack already in place:**

- React 18 + Vite 5
- Tailwind CSS 3 (+ postcss, autoprefixer)
- react-router-dom 6
- **No Firebase yet. No QR libraries yet. No test framework yet. No EmailJS yet.**

**`package.json` dependencies:** `react`, `react-dom`, `react-router-dom` only.
**Dev deps:** `@vitejs/plugin-react`, `autoprefixer`, `postcss`, `tailwindcss`, `vite`.
Scripts: `dev`, `build`, `preview` (no `test` script yet).

**Routing is already wired** in `src/App.jsx`:

| Route | Component | Audience |
|---|---|---|
| `/` → redirects to `/admin` | — | — |
| `/register/:eventId` | `PublicRegister` | public, no login |
| `/me/:claimToken` | `StudentSelfService` | attendee, token link |
| `/scan` | `GateScanner` | gate staff, login |
| `/admin` | `AdminHome` | admin (event list/switcher) |
| `/admin/event/:eventId` | `AdminDashboard` | admin |
| `/admin/event/:eventId/registrations` | `AdminRegistrations` | admin |
| `/admin/event/:eventId/settings` | `AdminSettings` | admin |
| `/admin/event/:eventId/export` | `AdminExport` | admin |
| `*` | `NotFound` | — |

**Every page component is a stub** — e.g. `GateScanner.jsx` is literally
`export default function GateScanner() { return <h1>Gate Scanner</h1> }`. All 9 pages under
`src/pages/` look like this. `src/components/` and `src/lib/` are empty (just `.gitkeep`).

**Folder layout:**

```
src/
  App.jsx            # routes (done)
  main.jsx           # BrowserRouter entry (done)
  index.css          # Tailwind directives
  components/        # empty
  lib/               # empty — put the time engine + firebase client here
  pages/             # 9 stub pages
```

**So the work ahead is: everything except routing and the design shell.**

---

## 2. What the system does (one paragraph)

*(This is the product being built for AWS SBG Global City. "Hackathon/seminar/workshop" below are
just the event formats the system can run — not the context this project exists in.)*

Attendees self-register on a public form. An admin approves them, which mints a random QR token and
emails a QR ticket. At the venue, gate staff scan QR codes with a phone/laptop camera; the system
auto-detects IN vs OUT and appends an immutable scan event. A **time engine** reconstructs sessions
from those scans, credits only time inside admin-defined "active windows," and derives each
attendee's total time + certificate eligibility **on read** (never stored). Admins watch a live
dashboard, fix errors via an append-only correction log, and export a `name,email` CSV of eligible
attendees that feeds the group's existing **CertFlow** certificate generator. The system is
**multi-event**: many events run from one deployment, possibly concurrently, with each event's data
isolated under its own path.

---

## 3. Tech stack to add

| Layer | Library | Notes |
|---|---|---|
| QR generation | `qrcode` or `qrcode.react` | one QR per approved attendee |
| QR scanning | `html5-qrcode` | browser camera at the gate |
| Backend / DB | Firebase Realtime Database | real-time sync, no server code |
| Auth | Firebase Auth | staff/admin login + role separation |
| Access control | RTDB Security Rules | server-side enforcement (see §8) |
| Email | EmailJS | client-side; public key is domain-restricted |
| PDF export | `jsPDF` + `html2canvas` | report |
| CSV | `PapaParse` or native | analytical + CertFlow-ready exports |
| Tests | **Vitest** + `@testing-library/react` | not installed yet — add it |
| Hosting | Firebase Hosting or Vercel | HTTPS by default |

Pin versions. Firebase + EmailJS config via `.env` (`VITE_` prefixed), with a committed
`.env.example` holding placeholders only.

---

## 4. THE ONE ARCHITECTURAL RULE — derived state

**Only raw scan events are stored. Every figure that affects a certificate is derived from them at
read time.** There is **no** stored `total_time_minutes`, `current_status`, or `is_eligible`.

Why: this stack has no server code — React, Firebase, Auth, EmailJS all run in the browser. If
`is_eligible` were a stored field, a browser would have to write it, and the users are computing
students with dev tools. Deriving it means there is nothing to tamper with, no counter that can
drift, retroactive settings changes "just work," corrections are additive, and any number can be
traced to the scans that produced it.

| Value | How it's produced |
|---|---|
| `current_status` (inside/outside) | read from the attendee's most recent accepted scan |
| `total_time_minutes` | summed from session pairs at read time |
| `is_eligible` | `total >= min_minutes_required`, compared at read time |

Cost is recomputation per read — trivial for a few hundred attendees and a few thousand scans.

---

## 5. Data model (Firebase Realtime Database — JSON tree, push IDs, NO arrays)

Arrays are avoided because concurrent writes to array indices in RTDB can overwrite each other (real
hazard with multiple gates). **All event-owned data lives under `/events/{eventId}/`** — isolation
by path, not by filter.

```
/events/{eventId}/
  ├── meta          name, event_type(hackathon|seminar|workshop), venue, description,
  │                 status(draft|active|ended|archived), created_at, created_by
  ├── settings      qr_valid_from, qr_valid_until (ISO8601 +08:00),
  │                 min_minutes_required (int, editable),
  │                 active_windows/{windowId}/{starts_at, ends_at, label},
  │                 max_session_minutes (safety cap), registration_open (bool)
  ├── attendees/{attendeeId}
  │                 full_name, email, organization,
  │                 status(pending|approved|rejected),
  │                 qr_token (128-bit random, ONLY on approval), qr_revoked (bool),
  │                 claim_token (128-bit random, self-service),
  │                 created_at, approved_at, approved_by,
  │                 consent_given, consent_at
  ├── scan_events/{scanId}   APPEND-ONLY
  │                 attendee_id (null if token matched nothing),
  │                 direction(in|out),
  │                 outcome(accepted|rejected_invalid|rejected_expired|rejected_revoked
  │                         |rejected_cooldown|rejected_not_approved),
  │                 method(qr|manual_lookup), scanned_at (SERVER timestamp),
  │                 gate_id, scanned_by (staff uid)
  └── corrections/{correctionId}   APPEND-ONLY
                    attendee_id, type(insert_missing_scan|void_scan|adjust_minutes),
                    target_scan_id, payload, reason (REQUIRED), corrected_by, corrected_at

/staff/{uid}              GLOBAL — one admin team for all events
                          email, role(admin|gate_staff), display_name, active
/qr_index/{qr_token}      GLOBAL lookup → { event_id, attendee_id }
```

`/staff` and `/qr_index` sit **outside** `/events/` on purpose. `/qr_index` lets the scanner resolve
a scanned token to its event without reading every event's roster. Random tokens leak nothing.

**Rejected scans ARE stored** (per event) — needed to answer "I scanned, why do I have no time?"

Naming: **event type** = format (hackathon/seminar/workshop). **`eventId`** = a specific instance
(e.g. "BITSKWELA 2026"). One instance has exactly one type.

---

## 6. Time engine (BUILD THIS FIRST — pure functions in `src/lib/`)

A **session** = an `in` scan followed by an `out` scan for one attendee, reconstructed from accepted
scans in chronological order. Duration is credited **only for time inside an active window**.

**Active windows** = admin-declared periods when the event is actually running. This kills the
overnight-inflation problem: an attendee who sleeps at a 60-hour-window venue without scanning out
should not out-rank one who honestly scans out each night. Only declared hours count.

Example 3-day hackathon: Day1 10:00–22:00 (12h), Day2 08:00–22:00 (14h), Day3 08:00–22:00 (14h) =
**40h countable**. A 16h requirement against 40h is achievable and fair.

### Algorithm (pseudocode — implement as pure, tested functions)

```
computeAttendeeTime(attendee, scanEvents, corrections, settings):
  events ← accepted scans for attendee, ascending by scanned_at
  events ← applyCorrections(events, corrections)   // insert / void, still ordered
  total ← 0 ; open ← null
  for event in events:
    if event.direction == "in":
        if open is null: open ← event.scanned_at    // "in" while open → ignored (no double-open)
    else: // "out"
        if open is not null:
            total ← total + countableMinutes(open, event.scanned_at, settings)
            open ← null                              // "out" while not open → ignored (no negative)
  if open is not null:                               // still inside
    cutoff ← min(now, endOfCurrentOrLastActiveWindow, open + max_session_minutes)
    total ← total + countableMinutes(open, cutoff, settings) ; live ← true
  total ← total + sum(adjust_minutes corrections)
  return { total_minutes, is_inside: open != null, is_eligible: total >= min_minutes_required }

countableMinutes(from, to, settings):
  sum ← 0
  for w in settings.active_windows:
    overlapStart ← max(from, w.starts_at) ; overlapEnd ← min(to, w.ends_at)
    if overlapEnd > overlapStart: sum ← sum + minutes(overlapStart, overlapEnd)
  return sum
```

The two "ignore" rules (in-while-open, out-while-not-open) are the exact states a duplicated or
dropped scan produces — ignoring them means one glitch can't corrupt every later session.

### Edge cases the tests MUST cover

| Situation | Resolution |
|---|---|
| Never scans out at end of day | session closes at active window's end |
| Never scans out at end of event | session closes at final window's end |
| Session exceeds `max_session_minutes` (default 14h) | credit capped, flag for review |
| Duplicate `in` scans | 2nd+ ignored |
| `out` with no matching `in` | ignored (no negative time) |
| Scan outside QR validity | rejected `rejected_expired`, no time |
| Still inside now | live timer to `now`, bounded by window end + cap |
| Event spans midnight | absolute `+08:00` timestamps, no special date logic |
| Admin lowers threshold after event | everyone re-evaluated on next read |

**Timezone:** all timestamps absolute with `+08:00`, written via Firebase **server timestamp** (never
device clock — gate phones have wrong clocks). Display/export in Asia/Manila.

---

## 7. Modules to build (each is a page or feature)

- **Module 0 — Event management + switcher** (`AdminHome`): list events w/ status+counts, create
  event, active-event switcher with a **persistent banner** showing the active event (acting on the
  wrong event is the top admin risk), archive (reversible).
- **Module 1 — Public registration** (`PublicRegister`, `/register/:eventId`): event details +
  stated certificate requirement, fields (full_name, email, organization), consent checkbox
  (unchecked by default), saves as `pending` with **no QR**, shows self-service link in
  confirmation, duplicate-email detection, per-IP throttle + light CAPTCHA, honors
  `registration_open`.
- **Module 2 — Admin registration mgmt** (`AdminRegistrations`): list by status, approve/reject
  (single + bulk). **On approval:** mint 128-bit random `qr_token`, render QR, email it, write
  `/qr_index`. Manual add (walk-ins), bulk CSV upload (preview + per-row validation before commit,
  throttled email queue), revoke, re-issue (invalidates old token).
- **Module 3 — Event settings** (`AdminSettings`): per-event. name, type, venue, qr_valid_from/until,
  active_windows, min time, max_session_minutes, registration_open. **Show total countable hours next
  to the requirement and warn if requirement > countable hours.** Defaults: Hackathon 16h, Seminar
  3h, Workshop 4h30m (all editable).
- **Module 4 — Gate scanner** (`GateScanner`, `/scan`): PWA. Resolve token via `/qr_index` → event +
  attendee. Reject invalid/revoked/not-approved/expired (each logged). **5-second cooldown** per
  token (camera fires several times/sec — without this, one presentation = IN then OUT and the timer
  silently freezes). Direction from current session state. **Feedback for queue conditions:**
  full-screen color (green IN / amber OUT / red reject), distinct sound per outcome, large attendee
  name + initials avatar (the only anti-proxy check), direction + timestamp + total + progress,
  auto-reset to camera after 2s. **Fallbacks:** manual name lookup (`method: manual_lookup`), offline
  queue in localStorage flushing on reconnect (preserve timestamps), `gate_id` per device.
- **Module 5 — Live dashboard** (`AdminDashboard`): stats bar (inside / registered / not-arrived /
  eligible / needs-review), attendee rows (name, status badge w/ live timer, total, eligibility or
  progress like `2h15m / 3h`), searchable/filterable, **paginated** live scan log incl. rejections,
  corrections tool (insert missing scan / void scan / adjust minutes — each needs a written reason,
  append-only, original preserved).
  **Concurrent-overlap detection:** admin-side, read-only check across active events — if one
  **email** has an open session (inside) in 2+ events over overlapping time, flag `concurrent_overlap`
  under needs-review (proxy / shared QR). Derive at read time, **write nothing**, no global person
  record; **flag, don't block** (R18, criterion 17). Email is the identity link (unique per event).
- **Module 6 — Eligibility & export** (`AdminExport`): final list, filter (all/eligible/non), sort,
  **pre-export reconciliation** (flag open/capped/no-exit sessions, force confirm/correct).
  **Exports:** (1) analytical CSV (name,email,org,minutes,duration,session count,eligibility,flags),
  (2) **CertFlow-ready CSV** = exactly `name,email` header, eligible-only, UTF-8 — drops straight
  into CertFlow, (3) PDF with event header. Header records threshold + countable hours so the report
  stays interpretable later. Plus a configurable **"Open CertFlow" shortcut** link
  (`awsc-certificate-automation.streamlit.app`) beside the CSV — convenience only, not automation;
  the coupling stays the CSV.
- **Module 7 — Student self-service** (`StudentSelfService`, `/me/:claimToken`): no account. My QR
  (guaranteed retrieval when email fails), my status + progress (`2h15m of 3h — 45m to go`),
  prominent scan-out reminder while inside, my scan history, request-review (creates dispute trail).
  **Use ONE-TIME READS, not live listeners** (see quota note §9).

---

## 8. Security (enforced in DB rules + data model, NOT UI)

`qr_token` = 128-bit crypto-random, **never derived** from name/email/id. Token exists **only after
approval**. Revocation immediate; re-issue invalidates prior. `claim_token` separately random.

**RTDB rules per `/events/{eventId}/`:**

| Path | Public | Gate Staff | Admin |
|---|---|---|---|
| `meta`, `settings` | read (details only) | read | read+write |
| `attendees` | **create pending only, NO read** | read via token lookup only | full |
| `attendees/*/status`, `/qr_token` | denied | denied | write |
| `scan_events` | denied | **append only** | append+read |
| `scan_events/*` edit/delete | denied | denied | **denied (all)** |
| `corrections` | denied | denied | append+read |
| `/staff` (global) | denied | read self | full |
| `/qr_index/{token}` (global) | denied | read | read+write |

Load-bearing facts: **public cannot read `/attendees`** (registration writes, never reads — else
every attendee's PII is exposed in the console). **Isolation is by path** (no cross-event query
exists). **`scan_events` append-only for everyone incl. admins** (corrections append). **Gate staff
cannot read the roster.**

Field validation: `scanned_at` must equal server timestamp; `outcome`/`direction` must be in allowed
sets; public writes reject `status`/`qr_token`/`claim_token`/approval fields; `/qr_index` write is
admin-only at approval time.

**Residual risks (can't fully eliminate):** proxy attendance (mitigate: name-on-scan + one open
session/token + review flags; **plus concurrent-overlap flag across active events — R18**); EmailJS
public key visible (domain-restrict it); volunteer mis-scan (mitigate: feedback + correction path).

---

## 9. Constraints, privacy, quotas

- **Data Privacy Act (RA 10173):** privacy notice on form, explicit consent (recorded), purpose
  limitation, gate staff can't read PII, retention purge (default 90 days), no PII in logs, HTTPS.
- **Firebase Spark free tier: 100 simultaneous connections.** → Self-service uses **one-time reads**;
  live listeners reserved for admin dashboard + gate devices only. This limit is **shared across
  concurrent events** (per project, not per event).
- **EmailJS free tier ~200 emails/month** → verify before event; self-service page guarantees QR
  retrieval regardless of email.

**Performance targets:** scan→confirm <2s; 6 attendees/min/gate; 4 gates no contention; 500
attendees/event; dashboard <3s propagation; time computation <100ms for 500 attendees + 5000 scans;
scanner one-handed/outdoors after 2-min briefing; 4.5:1 contrast; usable at 360px, body text ≥16px.

---

## 10. Integrations

- **Registration:** stays **native** (public form + admin approval). Luma was evaluated and
  **rejected** (webhooks are paid, external QR dependency, no added value, extra failure mode).
- **Certificates:** **CertFlow** (the group's Python/Flet MIT-licensed bulk cert generator +
  emailer), deployed at `awsc-certificate-automation.streamlit.app`. Handoff is a **CSV, not a code
  merge** — this system decides WHO is eligible, CertFlow produces + sends the cert. Contract: exactly
  `name,email` columns, eligible-only rows, UTF-8. Module 6 adds a configurable **"Open CertFlow"
  shortcut** link beside the CSV export (convenience only — still upload + send in CertFlow).

---

## 11. Suggested build order (propose your own if better)

1. **Setup:** add Vitest + testing-library; Firebase project + `.env.example`; RTDB security rules +
   a rules test asserting public cannot read `/attendees`; Auth with admin/gate_staff roles; a small
   design system (tokens, buttons, cards) since the UI is all stubs.
2. **Time engine** (`src/lib/timeEngine.js`) + full unit suite for every §6 edge case. Prove it
   before any UI uses it.
3. **Registration + approval** (Modules 1–2) incl. QR mint + `/qr_index` write + EmailJS + claim link.
4. **Gate scanner** (Module 4) incl. cooldown, direction, offline queue, manual lookup, feedback UI.
5. **Dashboard + settings** (Modules 5, 3) incl. countable-hours validation + corrections tool.
6. **Self-service + export** (Modules 7, 6) incl. reconciliation + CertFlow CSV + PDF.
7. **Testing + deploy:** integration, multi-event isolation, concurrency, resilience, accessibility;
   pilot event; hosting.

---

## 12. Acceptance criteria (the ones that matter most)

1. Unapproved registration cannot obtain a working QR by any client-side means (incl. direct DB writes).
2. Public registration page cannot read any other attendee's PII.
3. Repeated scans alternate IN→OUT correctly; repeats within 5s ignored without corrupting state.
4. 3 separate visits → total = sum of countable portions, verifiable by hand from the log.
5. Overnight-without-scanout attendee credited only for time inside active windows.
6. Attendee still inside at event end → session closed at final window end, complete total.
7. Dashboard headcount matches manual count of open sessions at any moment.
8. Gate staff querying DB directly cannot read roster or delete a scan.
9. Lowering the threshold after the event re-evaluates everyone with no migration step.
10. Every correction is in the audit trail (actor, time, reason); original scan intact.
11. CSV + PDF export with complete totals, no null durations.
12. A student can retrieve QR + see accumulated time with no email received.
13. Scanner survives a simulated 60s outage and syncs correctly on reconnect.
14. Two events active: an Event-1 QR resolves to Event 1 only, never appears in Event 2.
15. An Event-1 attendee cannot be read by any Event-2-scoped request (incl. direct query).
16. Creating/editing/archiving one event leaves every other event's data unchanged.

---

## 13. Open decisions (ask me before assuming)

1. Default active-window schedules for a typical STI hackathon / seminar / workshop.
2. Retention period (90 days assumed — confirm vs STI policy).
3. Grace allowance for a late scan-in, or is scan time absolute?
4. Partial certificates (a lower tier) or strictly binary eligibility?
5. Number of gates (affects device count + staffing).
6. EmailJS current plan monthly limit vs expected attendee volume.
7. Per-organizer access (true multi-tenancy) — needed soon or genuinely later?

---

**Reminder to Claude:** start with the build-order proposal + testing setup + first module, then
wait for my go-ahead. Build TDD, module by module, secrets in `.env`, and ask when unsure.
