# PROJECT PLAN

## Event Attendee Time Tracking & Certificate Eligibility System

**A web-based QR-powered attendance management platform**
AWS Student Builder Group — STI College Global City

**Prepared by:** Rhenmart — AWS Cloud Club Lead & Full-Stack AI Orchestrator
**Organization:** AWS Student Builder Group, STI College Global City, Taguig
**Document type:** Implementation Plan (companion to the Academic Project Proposal)
**Version:** 3.1 — production deployment plan, multi-event

---

### How to read this document

Sections 1–10 follow the approved Project Proposal one-to-one, so this plan can be read alongside the paper. Sections 11–16 are additions required because this system will be **deployed for real use with real student attendees**, where an incorrect result denies a student a certificate they earned. A campus deployment carries obligations a demo does not: correctness under dispute, protection of student personal data, and usability by untrained volunteers under queue pressure.

Material added or corrected relative to the proposal is summarized in the Revision Notes at the end.

---

# SECTION 1
## Executive Summary

This plan covers the design and development of an **Event Attendee Time Tracking and Certificate Eligibility System** — a web-based platform built by the AWS Student Builder Group at STI College Global City. The system uses QR code technology to automate attendance monitoring and to determine certificate eligibility for event participants.

The system addresses a common problem in academic and community events: there is no objective, automated way to measure how long attendees were actually present. Replacing manual sign-in sheets with QR-based gate scanning produces accurate, auditable time records that can defensibly serve as the basis for certificate distribution.

The platform supports three event formats — **Hackathon, Seminar, and Workshop** — each with configurable minimum attendance requirements. Administrators retain full control over registration approval, QR validity windows, and eligibility thresholds.

The system is **multi-event**: the AWS Student Builder Group admin team runs many events from a single deployment, and several events may be active at the same time — for example a hackathon in one room and a seminar in another on the same day. Each event's data is fully isolated from every other event's, so an attendee, scan, or report belonging to Event 1 never mixes with Event 2, while all events share one cloud backend and one admin team. Section 6 explains the model.

### Key capabilities

- **Multi-event, one deployment** — many events run concurrently with fully isolated data per event, all managed by one admin team through a single cloud backend
- **Hybrid registration** — attendees self-register through a public form; an administrator approves before any QR is issued
- **Temporary QR codes** delivered by email on approval, valid only inside the configured event window
- **Real-time gate scanning** using the device camera, with automatic IN/OUT detection
- **Multiple session support** — attendees may leave and return; time accumulates across all sessions
- **Countable-hours model** — time is credited only during administrator-defined active event hours, so overnight and closed periods cannot inflate a multi-day total
- **Live administrator dashboard** — running timers, live headcount, per-attendee status
- **Student self-service portal** — attendees check their own accumulated time and eligibility progress during the event
- **Configurable eligibility threshold** per event type
- **Post-event export** — CSV and PDF reports of eligible and non-eligible attendees
- **Full audit trail** — every scan, rejection, and administrative correction is recorded

### Design principle governing the whole system

**Only raw scan events are stored. Every figure that affects a certificate is derived from them.** Total time and eligibility are computed on read, never written to the database as standalone values. This single decision means there is no stored eligibility flag for anyone to tamper with, no cached total that can silently drift out of step with reality, and no possibility of a report disagreeing with the underlying log. It is what makes the system's output defensible when a student disputes a result. Section 5 explains the mechanism.

---

# SECTION 2
## Problem Statement

Academic and community events in the Philippines — particularly hackathons, seminars, and workshops — typically distribute certificates of participation to all registered attendees regardless of actual attendance duration. This creates three problems.

**Problem 1 — Lack of objective attendance measurement.**
Manual sign-in sheets record only that an attendee was present at a single moment, usually arrival. They do not capture early departures, extended absences, or the real number of hours an attendee was engaged. Determining who genuinely participated becomes impossible.

**Problem 2 — Certificate credibility.**
When certificates are issued on the basis of registration rather than verified attendance, their value as proof of participation collapses. An attendee who stayed five minutes receives the same certificate as one who stayed the entire event.

**Problem 3 — No basis for resolving disputes.**
Under a paper system, an attendee who believes their attendance was recorded incorrectly has no evidence to appeal with, and the organizer has none to justify the decision. Because certificates carry real value for students, any system that automates this decision must be able to show *why* it reached a given result.

### The solution

The system uses QR-based gate tracking to measure actual time inside the venue, then automatically computes whether each attendee met the administrator-defined minimum. Only attendees meeting the threshold are marked certificate-eligible. Every figure traces back to a timestamped scan record, so any result can be explained and, where genuinely wrong, corrected on the record.

---

# SECTION 3
## Project Objectives

### General Objective

To design and develop a web-based Event Attendee Time Tracking and Certificate Eligibility System that automates attendance monitoring using QR code technology and objectively determines certificate eligibility based on verified time spent inside the event venue.

### Specific Objectives

**1. To implement a hybrid attendee registration system** allowing self-registration through a public form with administrator approval before QR issuance.
- Attendees fill out a public form with name, email, and relevant details.
- Submissions enter a pending queue visible to the administrator.
- On approval, a temporary QR code is generated and emailed to the attendee automatically.
- No QR token exists in the database until approval occurs, so an unapproved registration has no credential to present or forge.

**2. To develop a real-time QR-based gate scanning system** with automatic IN/OUT detection.
- Gate staff scan attendee QR codes with a device camera (phone or laptop).
- The system determines whether a scan is an entry or exit from the attendee's current session state.
- Multiple entry-exit sessions are supported within the event's QR validity window.
- Repeat reads of the same code within a short cooldown are ignored, so a single presentation of a QR cannot register as an entry and an exit at once.

**3. To build a live administrator dashboard** displaying real-time attendance data.
- Running timer for each attendee currently inside the venue.
- Live headcount of attendees inside, outside, not yet arrived, and certificate-eligible.
- Chronological scan log covering all gate events, including rejected scans.

**4. To implement a configurable certificate eligibility engine.**
- Administrator sets event type (Hackathon, Seminar, Workshop) and minimum time requirement.
- Each event type carries a suggested default, fully editable.
- The system computes total countable time per attendee and tags eligibility in real time.

**5. To implement QR code expiry management** controlled by the administrator.
- Administrator sets the QR validity window — start and end date/time.
- Expired QR codes are rejected at the gate with a clear message; no time is logged.

**6. To define and enforce a fair time-counting model** covering the situations a multi-day event actually produces: overnight periods, forgotten exit scans, and attendees still inside when the event closes.

**7. To provide attendee self-service visibility**, allowing students to check their own accumulated time and remaining requirement during the event, while there is still time to act on it.

**8. To provide post-event reporting** via CSV and PDF export.
- Full attendee list with total time inside and certificate eligibility status.
- Filterable — export eligible attendees only, or all attendees.

**9. To protect attendee personal data** in line with the Data Privacy Act of 2012 (RA 10173) and STI College policy.

---

# SECTION 4
## Scope and Limitations

### Scope

- Web-based system accessible by browser — no mobile app installation required
- Supports three event types: Hackathon, Seminar, Workshop
- **Multiple events from one deployment**, which may run concurrently, with each event's data isolated under its own path in a shared cloud backend
- **Event switcher** — the admin team selects which event to manage; each surface (registration, scanner, dashboard, self-service) is scoped to one event at a time
- **Administrator panel** — registration management, event settings, dashboard, corrections, export
- **Public registration page** — attendee self-registration form
- **Gate scanner page** — camera-based QR scanning for IN/OUT logging
- **Student self-service page** — attendee checks own time, eligibility progress, and re-retrieves QR
- Firebase Realtime Database backend, enabling multi-device real-time sync
- Email delivery of QR tickets to approved attendees
- Bulk CSV upload for pre-event attendee import
- CSV and PDF export of the post-event attendance report
- Administrator correction of scan errors, with full audit trail
- Role separation between administrator and gate staff

### Limitations

- **Internet connection required.** Offline scanning is not supported. Section 12 (R3) defines the fallback procedure when venue connectivity fails.
- **Scan reliability depends on camera quality and lighting** at the gate. Section 7 (Module 4) defines fallbacks for unreadable codes.
- **Identity is not verified beyond the QR code.** Physical ID checking remains the responsibility of gate staff. The scanner displays the registered attendee name on every scan so staff can detect an obvious mismatch, but the system cannot by itself prevent a student from presenting another student's QR.
- **One shared admin team across all events.** Every administrator can see and manage every event. The system does not partition access so that one organizer sees only their own event — that per-organizer isolation (true multi-tenancy) is out of scope for this version. Data between events is isolated; *administrative access* is not.
- **Events are logically, not physically, separated.** All events live in one Firebase project under separate paths, not in separate databases. This delivers full data isolation per event while keeping a single deployment. A genuinely separate database per event is unnecessary here and is not implemented.
- **Email delivery depends on the email service and the recipient's inbox.** Because messages containing QR images are routinely filtered as spam, email is treated as a convenience channel rather than the sole means of QR retrieval — the self-service page in Module 7 guarantees an approved attendee can always reach their QR.
- **Free-tier service quotas apply.** Concurrent connections and monthly email volume are bounded; Section 11 states the limits and the mitigation for each.

---

# SECTION 5
## System Architecture & Technical Stack

### 5.1 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React.js + Tailwind CSS | UI for registration, scanner, dashboard, self-service |
| QR Generation | `qrcode.react` / `qrcode` | Generates unique temporary QR per approved attendee |
| QR Scanning | `html5-qrcode` (browser camera) | Gate scanner reads attendee QR via device camera |
| Backend / DB | Firebase Realtime Database | Stores attendees, scan events, settings — real-time sync |
| Authentication | Firebase Auth | Staff login; role separation for admin vs. gate staff |
| Access control | Firebase Realtime Database Security Rules | Server-side enforcement of who may read and write what |
| Email Delivery | EmailJS | Sends QR ticket email on approval |
| PDF Export | jsPDF + html2canvas | Downloadable PDF attendance report |
| CSV Export | PapaParse / native JS | Downloadable CSV attendance data |
| Hosting | Firebase Hosting / Vercel | Public deployment |

### 5.2 Application Structure

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Public           │  │ Student          │  │ Gate Scanner     │  │ Admin Panel      │
│ Registration     │  │ Self-Service     │  │                  │  │                  │
│ (no login)       │  │ (token link)     │  │ (staff login)    │  │ (admin login)    │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │                     │
         │                     │            ┌────────┴──────────┐          │
         │                     │            │  Firebase Auth    │◄─────────┘
         │                     │            │  role: staff /    │
         │                     │            │        admin      │
         │                     │            └────────┬──────────┘
         │                     │                     │
         ▼                     ▼                     ▼                     ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                    Firebase Realtime Database Security Rules                       │
│  • public may CREATE a pending registration, and read nothing back                  │
│  • only admin may write approval status or create a qr_token                        │
│  • only staff/admin may append scan events; nobody may edit or delete them          │
│  • no client may write total time or eligibility — those fields do not exist         │
└────────────────────────────────────┬───────────────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│                        Firebase Realtime Database (stored data)                     │
│                                                                                      │
│   /events/{eventId}/   ← each event is an isolated subtree                           │
│        ├─ Event 1:  meta  settings  attendees  scan_events  corrections              │
│        ├─ Event 2:  meta  settings  attendees  scan_events  corrections              │
│        └─ Event 3:  meta  settings  attendees  scan_events  corrections              │
│                     (concurrent, data never crosses between events)                  │
│                                                                                      │
│   /staff/       ← global: one admin team manages all events                          │
│   /qr_index/    ← global: token → {event_id, attendee_id} so a scan finds its event   │
│                                                                                      │
│                         ↑ raw facts only — nothing derived                           │
└────────────────────────────────────┬───────────────────────────────────────────────┘
                                     ▼
┌────────────────────────────────────────────────────────────────────────────────────┐
│              Time Engine — pure functions, run on the client at read time            │
│   scan_events + settings ──► sessions ──► countable minutes ──► eligibility          │
│   Same input always produces the same output. Nothing is written back.               │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 The Derived-State Architecture

The proposal's data structure stored `current_status`, `total_time_minutes`, and `is_eligible` as fields on each attendee. This plan removes all three from storage and computes them on demand instead. The reason is specific to this stack and this use case.

The chosen stack has no server-side application code. React, Firebase Realtime Database, Firebase Auth, and EmailJS all run in the browser. If `is_eligible` were a stored field, some browser would have to write it — and a browser is fully under the control of the person operating it. In a deployment whose users are computing students, a stored eligibility flag is a field that the people most affected by it are also the most capable of editing. Database rules can forbid writes to a field, but they cannot compute its correct value.

Deriving the value dissolves the problem rather than defending against it:

| Value | Proposal (stored) | This plan (derived) |
|---|---|---|
| `current_status` | Written on each scan | Read from the most recent scan event |
| `total_time_minutes` | Incremented on each scan | Summed from session pairs at read time |
| `is_eligible` | Written when threshold crossed | Compared against threshold at read time |

What this buys, concretely:

- **Nothing to tamper with.** The only writable attendance data is an append-only scan event, and only an authenticated staff account can append one.
- **No drift.** A stored counter that fails to increment once is wrong forever, and wrong invisibly. A derived total is recomputed from the log every time it is displayed, so the dashboard and the export cannot disagree with each other or with the raw record.
- **Retroactive settings changes just work.** If the administrator lowers the threshold from 16 hours to 14 after the event, every attendee's eligibility is correct on the next render. With stored flags this requires a migration pass over every record.
- **Corrections are additive.** Fixing a missed scan means appending a correction event, never overwriting history. The original record survives for audit.
- **Disputes are answerable.** Any number the system shows can be traced to the exact scan events that produced it.

The cost is recomputation on each read. For an event of a few hundred attendees with a few thousand scan events this is a trivial amount of arithmetic, well under the latency budget in Section 11. The trade is strongly favourable at this scale.

### 5.4 Stored Data Structure — Multi-Event

Firebase Realtime Database is a JSON tree. Keys use push IDs; **arrays are avoided**, because concurrent writes to an array-indexed path in Realtime Database can collide and overwrite one another — a real hazard when several gates scan at the same moment.

**All event-owned data lives under `/events/{eventId}/`.** This one structural choice is what makes the system multi-event: each event is a self-contained subtree, so Event 1's attendees, scans, and settings are on a completely different path from Event 2's. Isolation is achieved by *where the data lives*, not by a filter that has to be applied correctly on every read — a filter that is forgotten once leaks data across events, whereas a path that does not contain another event's data cannot leak it. The security rules in Section 9 enforce this boundary at the database level.

Note the naming: **"event type"** means the *format* (Hackathon / Seminar / Workshop), while **`eventId`** identifies a *specific event instance* (e.g. "BITSKWELA 2026"). One event instance has exactly one event type.

```
/events/{eventId}/
  │
  ├── meta
  │     name                                // "BITSKWELA 2026"
  │     event_type                          // hackathon | seminar | workshop
  │     venue, description
  │     status                              // draft | active | ended | archived
  │     created_at, created_by
  │
  ├── settings
  │     qr_valid_from, qr_valid_until        // ISO 8601 with +08:00 offset
  │     min_minutes_required                 // integer, editable
  │     active_windows/                      // countable hours — see Section 6
  │       {windowId}/ { starts_at, ends_at, label }
  │     max_session_minutes                  // safety cap on a single session
  │     registration_open                    // boolean
  │
  ├── attendees/{attendeeId}
  │     full_name, email, organization
  │     status                               // pending | approved | rejected
  │     qr_token                             // 128-bit random; created ONLY on approval
  │     qr_revoked                           // boolean
  │     claim_token                          // 128-bit random; self-service access
  │     created_at, approved_at, approved_by
  │     consent_given, consent_at            // Data Privacy Act record — Section 10
  │
  ├── scan_events/{scanId}                   // APPEND-ONLY
  │     attendee_id                          // null when the token matched nothing
  │     direction                            // in | out
  │     outcome                              // accepted | rejected_invalid
  │                                          //   | rejected_expired | rejected_revoked
  │                                          //   | rejected_cooldown | rejected_not_approved
  │     method                               // qr | manual_lookup
  │     scanned_at                           // server timestamp
  │     gate_id
  │     scanned_by                           // staff uid
  │
  └── corrections/{correctionId}             // APPEND-ONLY
        attendee_id
        type                                 // insert_missing_scan | void_scan | adjust_minutes
        target_scan_id                       // when voiding
        payload                              // e.g. { direction, timestamp } or { delta_minutes }
        reason                               // REQUIRED free text
        corrected_by, corrected_at

/staff/{uid}                                 // GLOBAL — shared across all events
  email, role                                // admin | gate_staff
  display_name, active

/qr_index/{qr_token}                         // GLOBAL lookup — see note below
  { event_id, attendee_id }
```

Two nodes sit **outside** `/events/` on purpose:

- **`/staff`** is global. There is one AWS club admin team managing every event (the B1 model), so staff accounts are shared rather than duplicated per event. A single admin logs in once and switches between events.
- **`/qr_index`** is a global token → `{event_id, attendee_id}` lookup. It exists to solve a problem specific to multi-event scanning: when a gate scans a QR, the scanner must find which event the token belongs to *before* it can read that event's data. Without this index the scanner would have to search every event's attendee list, which is both slow and would require read access to all events. The index maps the random token straight to its event. Because the token itself is unguessable (Section 9.1), the index leaks nothing useful — knowing a random string maps to some event ID reveals no personal data.

Rejected scans are still stored, per event. A log containing only successful scans cannot answer the most common support question at a real event — "I scanned, why does it say I have no time?" — because the evidence of the failed attempt is exactly what was discarded.

### 5.5 What Multi-Event Changes, and What It Does Not

The move to multiple events is a **scoping change, not a logic change**. This is a direct benefit of the derived-state architecture in 5.3: because nothing is precomputed and stored, there are no per-event aggregate counters to maintain, no cross-event totals that could accidentally sum together, and no eligibility flags to keep partitioned. The time engine in Section 6 is handed one event's scan events and one event's settings, and it neither knows nor cares that other events exist.

| Concern | Effect of going multi-event |
|---|---|
| Time computation logic (Section 6) | **Unchanged.** Operates on one event's data; oblivious to others |
| Eligibility derivation | **Unchanged.** Derived per event from that event's threshold |
| Scanner IN/OUT logic | **Unchanged.** Resolves token → event via `/qr_index`, then operates within that event |
| Registration, approval, corrections, export | **Unchanged in behavior;** every read/write is now prefixed with `/events/{eventId}/` |
| Security rules | **Extended** to enforce the per-event boundary (Section 9) |
| Admin UI | **Adds an event switcher** and an event-creation screen |
| `qr_valid_from` / `active_windows` | **Now naturally per event** — each event has its own window, so two concurrent events keep independent schedules |

Because the change is confined to scoping and access, it does not disturb the correctness guarantees the rest of the plan depends on.

---

# SECTION 6
## Time Computation Model

This section is new. The proposal specifies that time accumulates across sessions but does not define what happens in the situations a real multi-day event reliably produces. Because these rules decide who receives a certificate, they are stated explicitly here and are the primary subject of the test suite in Section 14.

### 6.1 Sessions

A **session** is a pair of consecutive accepted scan events for one attendee: an `in` followed by an `out`. Sessions are reconstructed by reading that attendee's accepted scan events in chronological order.

- An `in` with no following `out` is an **open session**.
- Duration is credited only for time falling inside an **active window** (6.2).

### 6.2 Active Windows — the countable-hours rule

The administrator defines one or more **active windows**: the periods during which the event is actually running and time may be credited.

This rule exists because the proposal's Hackathon default (16 hours, over a Sep 16 10:00 → Sep 18 22:00 validity window) cannot be satisfied fairly without it. That window spans 60 hours. Consider two attendees:

- **Attendee A** scans in at 10:00 on day 1, sleeps at the venue, and scans out at 22:00 on day 3. Raw elapsed time: **60 hours** — including two nights asleep.
- **Attendee B** participates identically but scans out each night and back in each morning. Raw elapsed time: **roughly 24 hours** of actual sessions.

Both attended the same event. Under raw elapsed time, A appears more than twice as committed as B, and the honest scanning behaviour is the one that gets punished. Crediting only time inside declared active windows removes the distortion, because the overnight hours are not countable for either attendee.

Example configuration for a three-day hackathon:

| Window | Starts | Ends | Countable |
|---|---|---|---|
| Day 1 | Sep 16, 10:00 | Sep 16, 22:00 | 12h |
| Day 2 | Sep 17, 08:00 | Sep 17, 22:00 | 14h |
| Day 3 | Sep 18, 08:00 | Sep 18, 22:00 | 14h |
| | | **Total countable** | **40h** |

A 16-hour requirement against 40 countable hours is achievable and meaningful. For a single-session Seminar or Workshop the administrator defines one window and the rule has no visible effect, so simple events are not complicated by it.

### 6.3 Computation Algorithm

```
computeAttendeeTime(attendee, scanEvents, settings):

  events  ← accepted scan events for attendee, ascending by scanned_at
  events  ← applyCorrections(events, corrections)   // insert / void, still ordered
  total   ← 0
  open    ← null

  for each event in events:
      if event.direction == "in":
          if open is null:  open ← event.scanned_at
          // an "in" while already open is ignored: cannot double-open
      else:                                          // "out"
          if open is not null:
              total ← total + countableMinutes(open, event.scanned_at, settings)
              open  ← null
          // an "out" while not open is ignored: cannot go negative

  if open is not null:                               // still inside
      cutoff ← min(now, endOfCurrentOrLastActiveWindow, open + max_session_minutes)
      total  ← total + countableMinutes(open, cutoff, settings)
      live   ← true

  total   ← total + sum(adjust_minutes corrections)
  return { total_minutes: total,
           is_inside: open is not null,
           is_eligible: total >= settings.min_minutes_required }


countableMinutes(from, to, settings):
  // intersect [from, to] with each active window; sum the overlaps
  sum ← 0
  for each w in settings.active_windows:
      overlapStart ← max(from, w.starts_at)
      overlapEnd   ← min(to,   w.ends_at)
      if overlapEnd > overlapStart:
          sum ← sum + minutes(overlapStart, overlapEnd)
  return sum
```

The two ignore rules matter more than they appear. `in` while already open, and `out` while not open, are the exact states produced by a duplicated or dropped scan. Handling them by ignoring the redundant event means a single glitch cannot corrupt every subsequent session for that attendee, which is the failure mode of a design that blindly toggles state.

### 6.4 Edge Cases and Their Resolution

| Situation | Resolution | Why |
|---|---|---|
| Attendee never scans out at end of day | Session closes at the active window's end | Otherwise the timer runs overnight and rewards the omission |
| Attendee never scans out at end of event | Session closes at the final window's end | A null or unbounded duration would break the report |
| Session exceeds `max_session_minutes` (default 14h) | Credit capped at the limit; flagged for admin review | Catches a stuck-open session that active windows alone would not, e.g. a single-day event with one long window |
| Duplicate `in` scans | Second and later ignored | Cannot inflate by rescanning |
| `out` with no matching `in` | Ignored | Cannot produce negative time |
| Scan outside QR validity window | Rejected, logged as `rejected_expired`, no time credited | Proposal requirement |
| Attendee still inside right now | Live timer counts to `now`, bounded by window end and session cap | Dashboard shows a running total |
| Event spans midnight | Windows are absolute timestamps with `+08:00` offset | Date boundaries carry no special meaning |
| Admin lowers threshold after the event | Everyone re-evaluated on next read | Eligibility is derived, not stored |

### 6.5 Timezone Handling

All timestamps are stored as **absolute values including the `+08:00` Philippine offset**, written using Firebase's server timestamp rather than the device clock. Gate devices are personal phones and laptops whose clocks are frequently wrong by minutes; using the device clock to timestamp a certificate-determining event would make the record depend on whose phone happened to be at the gate. Display and export render in Asia/Manila.

---

# SECTION 7
## System Modules

### Module 0 — Event Management & Switcher (new)

Administrator only. The entry point that makes the system multi-event.

- **Event list** — shows every event with its status (draft, active, ended, archived), type, dates, and live registered/inside counts. This is the admin's home screen.
- **Create event** — a new event is created with its own `meta` and `settings`. Creating an event does not touch any other event's data.
- **Active event switcher** — the admin selects which event they are currently managing. Every other admin surface — registration approval, dashboard, corrections, export — is scoped to the selected event. A persistent banner shows the active event name so the admin is never approving Event 2's attendees while looking at Event 1 by mistake. This banner is not cosmetic: with concurrent events, acting on the wrong event is the most likely admin error, so the current context is kept visible at all times.
- **Archive event** — marks an event `archived`, hiding it from the default list while retaining its data until the retention period expires (Section 10). Archiving is reversible; deletion is a separate, confirmed action.
- **Concurrency is normal here.** Two events can both be `active`. The registration page, scanner, and self-service page each operate on exactly one event, identified in their link, so concurrent events never interfere.

Because a public registration link and a self-service link each carry their event's identity, an attendee is always registering for, and viewing, exactly one specific event — there is no way for an attendee to land in the wrong event's data.

### Module 1 — Public Registration Page

Attendee-facing, open to anyone with the event link.

- Displays event details: name, type, date, venue, description, and the minimum time required for a certificate. Publishing the threshold up front is deliberate — an attendee who learns the requirement only after failing it has a legitimate grievance.
- Form fields: full name, email address, school or organization.
- Explicit consent checkbox with a link to the privacy notice (Section 10). Unchecked, the form does not submit.
- On submission the record is saved as `pending`. **No QR is generated.**
- Confirmation message: *"Your registration has been submitted. Please wait for admin approval. Your QR ticket will be sent to your email once approved."* The confirmation also shows the attendee's **self-service link** and advises saving it, so a lost or spam-filtered email is never a dead end.
- Duplicate email detection prevents double registration.
- Abuse protection: per-IP submission throttling and a lightweight CAPTCHA. An open form on a public link will otherwise be filled with junk that an administrator has to clear by hand.
- Registration can be closed by the administrator with the `registration_open` flag.

### Module 2 — Admin Registration Management

Administrator only. Controls who receives a QR ticket.

- Lists all registrations by status: Pending, Approved, Rejected. Searchable and sortable.
- Approve or reject individually, or select many and act in bulk. Bulk action matters when a few hundred registrations arrive the night before an event.
- **On approval:** the system generates a unique 128-bit random `qr_token`, renders the QR, and emails it. The token is random rather than derived from the attendee's name, email, or record ID — a derived token can be reconstructed by anyone who knows the inputs, which would let an unapproved person mint a working QR.
- **Manual add** — administrator registers an attendee directly for walk-ins and on-site registration.
- **Bulk CSV upload** — preview and per-row validation before commit, so a malformed file cannot half-import a roster. Email sending is queued and throttled with visible progress; see Section 11 for the volume limit.
- **Revoke** — sets `qr_revoked`, invalidating the QR at the gate immediately.
- **Re-issue** — generates a fresh token and revokes the previous one, so a QR that was shared or lost stops working rather than becoming a second valid copy.

### Module 3 — Event Settings

Administrator only. Configured per event, before that event begins. Settings edited here apply only to the event selected in the switcher (Module 0), so two concurrent events keep entirely independent configuration.

| Setting | Description | Example |
|---|---|---|
| Event name | Display name | BITSKWELA 2026 |
| Event type | Hackathon / Seminar / Workshop | Hackathon |
| Venue | Displayed on the registration page and report | STI Global City, Room 501 |
| QR valid from | Start of scanning window | Sep 16, 10:00 AM |
| QR valid until | End of scanning window | Sep 18, 10:00 PM |
| Active windows | Countable hours (Section 6.2) | 3 windows, 40h total |
| Minimum time | Required countable time for eligibility | 16 hours (editable) |
| Max session length | Safety cap on one unclosed session | 14 hours |
| Registration open | Public form on or off | On |

**Default minimum time per event type (editable):**
- Hackathon — 16 hours (multi-day format)
- Seminar — 3 hours (half or full day)
- Workshop — 4 hours 30 minutes (hands-on)

The settings page displays **total countable hours** next to the minimum requirement, and warns when the requirement exceeds what the declared windows make achievable. This makes the misconfiguration described in 6.2 visible before the event rather than after certificates are contested.

### Module 4 — Gate Scanner

Staff or administrator. Operated on-site at the entrance. Delivered as an installable PWA so a gate device launches it from the home screen without navigating a browser.

**Scan sequence:**

1. Camera reads the QR and resolves the token, then looks it up in `/qr_index` to find which event and attendee it belongs to. In a multi-event deployment the scanner does not assume a fixed event — the token itself determines the event, so the same gate device can serve concurrent events if needed.
2. **Token not in index** → `Invalid QR` — logged as `rejected_invalid`.
3. **Token revoked** → `QR no longer valid` — logged as `rejected_revoked`.
4. **Attendee not approved** → `Not approved` — logged as `rejected_not_approved`.
5. **Outside that event's validity window** → `QR Expired` — logged as `rejected_expired`, no time credited. Because each event has its own window, a QR for an event that has not started yet, or has already ended, is rejected even if another event is currently active.
6. **Same token within 5-second cooldown** → ignored with a neutral message, logged as `rejected_cooldown`.
7. **Otherwise accepted** → the scan is written under that token's event (`/events/{eventId}/scan_events`); direction is determined from the attendee's current session state within that event: no open session yields `in`, an open session yields `out`.

The 5-second cooldown addresses a property of camera scanning rather than a hypothetical: a decoder pointed at a QR fires continuously, several times per second. Without a cooldown, one presentation of a code registers as an entry immediately followed by an exit, and the attendee's time silently stops accumulating while the screen appears to have worked correctly.

**Feedback design — built for queue conditions**

The scanner is operated by student volunteers processing a line of people, often outdoors. Its correctness is worthless if its output cannot be read at a glance.

- **Full-screen colour response** — green for IN, amber for OUT, red for any rejection. Legible peripherally, without reading text.
- **Distinct sound per outcome** — three tones, so a volunteer not looking at the screen still knows what happened. Colour alone excludes colour-blind operators.
- **Attendee name in large type**, with initials avatar. This is the only check against a student presenting someone else's QR, so it is displayed prominently rather than incidentally.
- **Direction badge and timestamp**, plus **total accumulated time** and eligibility progress.
- **Auto-reset to camera after 2 seconds** — no tap needed between attendees. At 300 attendees, one required tap per scan is 300 opportunities for the queue to stall.

**Fallbacks — every one of these occurs at a real event**

- **Manual name lookup.** When a QR cannot be read at all — cracked screen, screen glare in daylight, dead battery, no smartphone, damaged printout — staff search by name and record the scan manually. Logged with `method: manual_lookup`. Without this path, one such attendee halts the entire queue.
- **Offline queue.** Scans are buffered in local storage when the network drops and flush automatically on reconnect, preserving their original timestamps. Venue Wi-Fi at a campus event is not dependable, and a gate that stops working when the network hiccups stops the event.
- **Gate identity.** Each device is tagged with a `gate_id`, so multi-entrance venues work without schema changes and every scan is attributable to a station.

### Module 5 — Live Admin Dashboard

Administrator only. Real-time view of event attendance.

**Top statistics bar**
- **Currently inside** — live count of attendees in the venue
- **Total registered** — all approved attendees
- **Not yet arrived** — approved with no accepted scan
- **Certificate eligible** — attendees who have already met the minimum
- **Needs review** — attendees whose records show an anomaly: capped session, long open session, an unusual scan pattern, or a **physically-impossible concurrent overlap** (see below)

**Concurrent-attendance overlap detection (multi-event).** When several events run at the same time, the same person can register for more than one — an ordinary, legitimate thing to do. What is *not* physically possible is being inside two venues at the same moment. Because the admin team sees every event (the B1 model), the dashboard performs an **admin-side, read-only** check across the currently active events: if one **email** holds an **open session (inside) in two or more events over overlapping time**, that attendee is flagged `concurrent_overlap` under **Needs review**. This is the signal of a shared QR or proxy attendance — the residual risk named in 9.4 — surfaced instead of silently accepted.

The check preserves the architecture rather than bending it: it reads each event's own scan data (which the admin may already read), derives the overlap at read time, and **writes nothing** — there is no new stored field and no cross-event write, so per-event isolation (5.4, 9.2) is untouched. Email is the identity link because email is unique per event; no global "person" record is introduced, so the privacy model in Section 10 is unaffected. Consistent with 9.4, the system **flags, it does not block** — the administrator investigates and decides, because only physical ID checking can confirm intent.

**Attendee list** — one row per attendee:
- Name and initials avatar
- Status badge — Inside (green, pulsing live timer), Outside (amber), Not yet arrived (grey)
- Total accumulated countable time
- Eligibility badge — Eligible (green) or a progress indicator such as `2h 15m / 3h` for those short of the threshold
- Searchable by name or email; filterable by status, eligibility, and review flag

Showing progress toward the threshold rather than a bare not-eligible state lets an administrator act while the event is still running — announcing a reminder, or noticing that a whole cohort is short because a gate was misconfigured.

**Live scan log** — chronological, including rejections, with name, direction, outcome, gate, and timestamp. Paginated rather than streaming the full history, to stay within the connection and bandwidth limits in Section 11.

**Corrections tool** — resolves the disputes a real deployment produces:
- *Insert a missing scan* — attendee entered while the gate device was offline
- *Void a scan* — a mis-scan, such as an exit recorded for someone who never left
- *Adjust minutes* — a documented manual allowance

Every correction requires a written reason and records who made it. Corrections are appended, never overwrites; the original scan event remains in the log. A record that can be edited invisibly is not evidence, and this system's entire justification is that its output can be defended.

### Module 6 — Certificate Eligibility & Export

Administrator only. Used at the end of the event to produce the final report.

- Final attendee list with total countable time and eligibility status
- Filterable — all attendees, eligible only, or non-eligible only
- Sortable by total time (descending) or name (alphabetical)
- **Pre-export reconciliation check** — flags open sessions, capped sessions, and attendees with no exit scan, requiring the administrator to confirm or correct each before export. This forces anomalies to surface before certificates are issued rather than after a student questions the result.

**Export formats**
- **Analytical CSV** — name, email, organization, total minutes, formatted duration, session count, eligibility, review flags. For the organizer's own records and analysis.
- **CertFlow-ready CSV** — exactly `name,email`, eligible attendees only, formatted to drop straight into the CertFlow certificate generator with no editing (Section 10A.2). This is the export that completes the register → certificate pipeline.
- **PDF** — formatted report with event header and attendee table

**Report header** — event name, type, date, venue, minimum time requirement, total countable hours available, total registered, total eligible, and generation timestamp. Recording the threshold and available hours inside the report itself means the document remains interpretable later, when the settings that produced it are no longer in front of the reader.

### Module 7 — Student Self-Service Page (new)

Attendee-facing, reached through the personal `claim_token` link. No account or password required, which matters because attendees are one-time users who will not create credentials for a single event.

- **My QR** — displays the attendee's QR, retrievable at any time. This is the guaranteed delivery path when email fails, and it removes the single most common on-site support request.
- **My status** — current state (inside / outside / not yet arrived), total accumulated time, and progress toward the threshold: *"2h 15m of 3h required — 45m to go."*
- **Reminder to scan out** — shown prominently while the attendee is inside, since a forgotten exit scan is the most common cause of a wrong total.
- **My scan history** — the attendee's own IN/OUT records.
- **Request review** — flags a suspected error for administrator attention, creating a dispute trail instead of an argument at the gate.
- Access is scoped strictly to the token holder's own record.

This module is the largest usability addition in this plan, and it exists because the deployment is real. Under the proposal as written, a student learns their attendance outcome only when certificates are distributed, at which point nothing can be done about a missed scan. Giving students visibility during the event converts a post-event complaint into a problem they can still fix, and moves the support burden off the organizing team.

---

# SECTION 8
## Complete User Flow

### Attendee Flow

| # | Step | What happens |
|---|---|---|
| 1 | Opens registration link | Visits the public event registration page; sees event details and the certificate requirement |
| 2 | Fills out form | Submits name, email, school/organization, and consent |
| 3 | Receives confirmation | Registration is pending; **self-service link shown and saved** |
| 4 | Receives QR email | Administrator approves; system emails the QR ticket |
| 5 | Arrives at event | Opens the QR from email or the self-service page |
| 6 | Gate staff scans QR | Logged as IN; timer starts; name confirmed on screen |
| 7 | Leaves temporarily | Staff scans again — logged as OUT; timer pauses |
| 8 | Returns to venue | Staff scans — logged as IN; timer resumes |
| 9 | Checks progress anytime | Self-service page shows accumulated time and remaining requirement |
| 10 | End of event | Any open session closes at the active window end; total computed; eligibility assigned |
| 11 | Disputes a result (if needed) | Requests review through the self-service page; administrator reviews the scan log |

### Gate Staff Flow

| # | Step | What happens |
|---|---|---|
| 1 | Logs in on the gate device | Staff account; scanner access only, no attendee roster |
| 2 | Confirms gate assignment | Selects or confirms `gate_id` |
| 3 | Scans attendees | Camera scanning with colour and sound feedback |
| 4 | Verifies name on screen | Confirms the QR matches the person presenting it |
| 5 | Handles unreadable QR | Falls back to manual name lookup |
| 6 | Continues through outages | Offline queue buffers scans and syncs on reconnect |

### Admin Flow

| # | Step | What happens |
|---|---|---|
| 1 | Creates or selects an event | Uses the event switcher to create a new event or open an existing one; all following steps act on the selected event only |
| 2 | Configures event settings | Event type, name, venue, QR validity, active windows, minimum time |
| 3 | Verifies configuration | Confirms countable hours exceed the minimum requirement |
| 4 | Creates staff accounts | Issues gate staff logins for volunteers (shared across events) |
| 5 | Monitors registrations | Reviews pending submissions for this event; approves or rejects, individually or in bulk |
| 6 | Bulk upload (optional) | Imports a CSV of pre-registered attendees into this event; queued QR sending |
| 7 | Opens gate scanner | Assigns devices to gates; briefs volunteers |
| 8 | Monitors dashboard | Watches headcount, live timers, scan log, and review flags for the selected event |
| 9 | Handles exceptions | Applies corrections with recorded reasons |
| 10 | Runs reconciliation | Resolves open and capped sessions before export |
| 11 | Post-event export | Downloads CSV and PDF of attendance and eligibility for this event |
| 12 | Archives / retention | Marks the event archived and purges attendee personal data after the retention period (Section 10) |

---

# SECTION 9
## Data Integrity & Security

The system decides who receives a certificate. That makes its records a target, and the likely adversary is a competent computing student with browser developer tools. The controls below are therefore enforced in database rules and in the data model, not in UI code — a hidden button is not access control, and any check that lives only in the React app can be bypassed by talking to Firebase directly.

### 9.1 Credential Integrity

- `qr_token` is a **128-bit cryptographically random value**, never derived from name, email, or record ID. A derived token is reproducible by anyone who knows the inputs.
- **A token exists only after approval.** The registration path cannot create one, so an unapproved registration has no credential at all rather than one that gets refused at the gate.
- **Revocation is immediate**, and re-issuing invalidates the prior token instead of creating a second working copy.
- `claim_token` for self-service is separately random, so a leaked QR does not expose the attendee's status page.

### 9.2 Access Control (Realtime Database Rules)

All event-owned paths below are under `/events/{eventId}/`. The rules apply per event, so a permission granted on one event does not carry to another.

| Path (under `/events/{eventId}/`) | Public | Gate Staff | Admin |
|---|---|---|---|
| `meta`, `settings` | read (event details only) | read | read, write |
| `attendees` | **create pending only** — no read | read via token lookup only | full |
| `attendees/*/status`, `attendees/*/qr_token` | denied | denied | write |
| `scan_events` | denied | **append only** | append, read |
| `scan_events/*` (edit, delete) | denied | denied | **denied** |
| `corrections` | denied | denied | append, read |
| **Global paths (outside `/events/`)** | | | |
| `/staff` | denied | read self | full |
| `/qr_index/{token}` | denied | read | read, write |

Four properties of this table carry most of the weight:

- **The public cannot read `/attendees`.** Registration writes but never reads. Without this, the registration page — which needs write access — would expose the name, email, and organization of every attendee to anyone who opens the console. This is the most likely serious data breach in a system of this shape.
- **Event isolation is enforced by path, not by filter.** Because attendee and scan data physically live under `/events/{eventId}/`, a rule granting access to one event's subtree grants nothing on another's. There is no cross-event query that could accidentally return another event's data, because there is no shared collection to query. This is why the isolation holds even if application code has a bug — the wrong data is not merely hidden, it is unreachable.
- **`scan_events` is append-only for everyone, including administrators.** Deletion is denied at the rules level, per event. Corrections work by appending, so history cannot be rewritten by anyone at all.
- **Gate staff cannot read the roster.** Volunteers are temporary and numerous; scanner access should not carry access to several hundred students' contact details. Note that in the B1 model gate staff accounts are global — a briefed volunteer can operate the scanner for whichever event they are assigned to — but their scan-only, no-roster restriction applies identically to every event.

### 9.3 Field-Level Write Validation

Rules validate structure, not just permission:
- `scan_events.scanned_at` must equal the Firebase **server timestamp**, so a client cannot backdate or forward-date a scan.
- `outcome` and `direction` must be members of their allowed sets.
- Registration writes accept only the expected fields — `status`, `qr_token`, `claim_token`, and approval metadata are rejected from a public write, closing the path where a crafted request self-approves.
- A `/qr_index` entry may be written **only by an admin, and only at approval time** (the same action that mints the token). This prevents anyone from planting an index entry that points a token at an event it does not belong to.
- `total_time_minutes` and `is_eligible` **are not writable because they do not exist in storage** (Section 5.3).

### 9.4 Known Residual Risks

Stated plainly, because a proposal claiming none would not be credible.

- **Proxy attendance.** A student can send a QR screenshot to another student. The system mitigates this by displaying the registered name on every scan for staff verification, and by permitting only one open session per token — a shared QR produces contradictory entries that surface in the review flags. It cannot eliminate the risk. Only physical ID checking closes it, and that is a staffing decision.
- **EmailJS public key exposure.** EmailJS is client-side by design, so its public key is visible in the browser bundle. It should be domain-restricted in the EmailJS dashboard, and quota should be monitored during the event. Moving email to a Cloud Function is the clean fix if the project later adopts the Blaze plan.
- **Gate staff error.** A volunteer can mis-scan. Mitigated by distinct feedback per direction and by the administrator correction path, not prevented.

---

# SECTION 10
## Data Privacy

The system collects personal information from students — name, email address, and school or organization — placing it within scope of the **Data Privacy Act of 2012 (RA 10173)**. The measures below reflect the Act's core requirements as published by the [National Privacy Commission](https://privacy.gov.ph/data-privacy-act/): collection for a specified and legitimate purpose, consent evidenced by written, electronic, or recorded means, and retention no longer than necessary. *(Content rephrased for compliance with licensing restrictions.)*

STI College's own data privacy policy takes precedence where it is stricter, and the organizing team should confirm this deployment with the school's data protection officer before the first live event.

**Implemented measures**

- **Privacy notice on the registration form**, stating what is collected, why, how long it is kept, and who can access it.
- **Explicit consent checkbox**, unchecked by default. Consent is recorded as `consent_given` and `consent_at` — an electronic record of consent as the Act contemplates.
- **Purpose limitation** — data is used for attendance tracking and certificate eligibility only, and is not repurposed for recruitment or marketing without separate consent.
- **Access limitation** — attendee personal data is readable only by administrators and by the attendee's own token-scoped self-service page. Gate staff cannot read it.
- **Retention and disposal** — personal data is purged after the reporting period (default 90 days post-event, configurable). Aggregate statistics may be retained without personal identifiers.
- **No personal data in logs** — application logs record attendee IDs and actions, never names or email addresses.
- **Right of access** — the self-service page lets an attendee see their own record, supporting the data subject rights the Act provides.
- **Transport security** — HTTPS throughout, by default on both Firebase Hosting and Vercel.

---

# SECTION 10A
## Ecosystem & Integrations

This system does not stand alone. It sits between two questions an event organizer already asks — *"who registered?"* at the front, and *"who gets a certificate?"* at the back. Two integration decisions were evaluated. One is rejected with reasons; one is adopted and specified.

### 10A.1 Registration — Luma (evaluated, not adopted)

The AWS Student Builder Group currently uses **Luma** (lu.ma) to set up events, and the option of registering attendees on Luma and feeding approved guests into this system was evaluated in depth.

**It is technically possible.** Luma exposes a [public API](https://docs.luma.com/reference/getting-started-with-your-api) and [webhooks](https://help.luma.com/p/webhooks) that fire on guest registration and guest updates (including approval status), and a [guest-lookup endpoint](https://help.luma.com/p/external-check-in-integration) that resolves a scanned Luma QR to a guest record. In principle: register on Luma → admin approves on Luma → the approved guest flows into this system → the Luma QR is scanned at the gate for time in/out. *(Content rephrased from Luma's documentation for compliance with licensing restrictions.)*

**It is not adopted, for four concrete reasons:**

1. **Webhooks require Luma Plus (paid).** Real-time sync — the part that makes the integration feel automatic — is a paid-tier feature. Without it, the only free path is manual CSV export from Luma and import here, which is not real-time and reintroduces the manual step the system exists to remove.
2. **The QR would not be ours.** A Luma QR encodes a `luma.com/check-in/...` URL. Every gate scan would then require a live lookup against Luma's API to resolve the guest before our own time engine could record anything — adding an external dependency to the single most latency-sensitive, most-repeated action in the whole system.
3. **The system's actual value is not in Luma.** Registration and approval are the cheap, commodity part. The time tracking, active-window model, and certificate-eligibility engine — the parts that justify building this at all — are entirely ours regardless. Luma would replace the one component we can already provide for free.
4. **Two systems, two failure modes.** Depending on Luma's uptime and API stability for a campus event means an outage or an API change on their side can break our gate. Self-contained registration removes that coupling.

**Decision:** registration stays **native** (the hybrid public form + admin approval already specified). Luma's clean, familiar UX is worth *emulating* in our own design, but not worth *depending on*. If the group later subscribes to Luma Plus and wants the integration, the webhook + guest-lookup path documented above is the route, and the derived-state architecture means it would slot in as an alternate registration source without disturbing the time engine.

### 10A.2 Certificate Distribution — CertFlow (adopted)

The back end of the pipeline is [**CertFlow**](https://github.com/Shibo326/AWSC-CERTIFICATE-AUTOMATION), the group's own MIT-licensed bulk certificate generator and emailer (Python + Flet; Pillow/ReportLab rendering; Gmail SMTP sending). It takes an attendee list, renders a personalized certificate from a template for each, and emails them in bulk.

This is the natural completion of this system's job. This platform decides **who is eligible**; CertFlow produces and delivers **the certificate**. The two form one pipeline:

```
  THIS SYSTEM (React + Firebase)                    CERTFLOW (Python + Flet)
 ┌────────────────────────────────┐               ┌──────────────────────────┐
 │ register → approve → scan       │   CSV file    │ upload template          │
 │ → time in/out → eligibility     │  ──────────►  │ → import list            │
 │ → EXPORT eligible attendees     │  name,email   │ → generate → bulk email  │
 └────────────────────────────────┘               └──────────────────────────┘
        decides WHO earned it                        produces & sends the cert
```

**Integration method — data handoff, not code merge.** The two are deliberately kept as separate tools:

- The stacks are incompatible by nature — this system is React/Firebase (web, JavaScript), CertFlow is Python/Flet (native app). Merging them into one codebase would require rewriting one in the other's language for no functional gain.
- Their real coupling is a single artifact: **the list of eligible attendees.** A CSV expresses that completely.
- Kept separate, each tool keeps working if the other is absent, and CertFlow remains reusable for events that never used this system.

**The export contract.** CertFlow's parser requires exactly two columns, `name` and `email` (case-insensitive headers), and rejects rows with a missing name, a malformed email, or a duplicate email. To guarantee a clean handoff, this system provides a dedicated **"CertFlow-ready export"** in Module 6, distinct from the full analytical CSV:

| Property | CertFlow-ready export |
|---|---|
| Columns | exactly `name,email` — no extra columns |
| Header | literally `name,email` (matches CertFlow's case-insensitive check) |
| Rows | **eligible attendees only** (`is_eligible == true` at export time) |
| Name field | the attendee's `full_name`, output under the `name` header |
| Encoding | UTF-8, standard CSV quoting |
| Deduplication | already unique per event (email is unique per event), so CertFlow finds no duplicates to reject |

Because eligibility is derived at read time (Section 5.3), this export always reflects the final, reconciled state at the moment it is generated — there is no stale flag to export by mistake. The result drops directly into CertFlow's import with zero manual editing, completing the pipeline from registration to certificate in the attendee's inbox.

**One-click handoff to the deployed CertFlow.** CertFlow is already deployed as a hosted web app at `https://awsc-certificate-automation.streamlit.app`. To make the handoff as short as it can be without merging the two codebases, the export screen (Module 6) shows a labelled **"Open CertFlow"** shortcut alongside the CertFlow-ready CSV download, with the two steps stated in order: (1) download the eligible CSV here, (2) open CertFlow, upload it, and send. This keeps the tools separate — the coupling remains the CSV artifact — while removing the friction of the admin hunting for the CertFlow URL. It is a convenience link, not automation: the admin still uploads the CSV in CertFlow and sends from there. The URL is kept as a single configurable constant so it can change without touching the flow.

---

# SECTION 11
## Capacity & Quotas

Free-tier limits are the most likely cause of a failure on event day, and each has a specific number attached. They are stated here so they are designed around rather than discovered live.

### 11.1 Service Quotas

| Constraint | Limit | Risk | Mitigation |
|---|---|---|---|
| Firebase RTDB simultaneous connections (Spark) | **100** | 300 students opening self-service pages with live listeners exceeds it, and the gate scanner is then denied a connection | Self-service page uses **one-time reads, not live listeners**. Live subscriptions are reserved for admin dashboard and gate devices — under 10 connections. |
| Firebase RTDB storage / transfer (Spark) | 1 GB stored, 10 GB/month down | Low; text records are small | Dashboard paginates instead of downloading the full scan log |
| EmailJS free tier | **~200 emails/month** | A 300-attendee event exceeds it mid-send, and approvals silently stop delivering | Verify quota before the event; upgrade or batch across the window. **Self-service page guarantees QR retrieval regardless of email outcome.** |
| Firebase Auth | Ample for staff accounts | None | Attendees do not have accounts |

The connection limit deserves emphasis: it is the one place where adding a user-friendly feature could break the core function. A self-service page built with live listeners would let student traffic starve the gate scanner of its connection, taking the event's critical path down. Using one-time reads makes the feature additive rather than competing.

**With concurrent events this limit is shared.** The 100-connection ceiling is per Firebase project, not per event, so two events running at once draw from the same pool. The mitigation is the same one that already protects a single event — one-time reads for attendees, live listeners reserved for the handful of admin dashboards and gate devices — which keeps the total connection count driven by the number of active gates and dashboards, not the number of attendees. Realistically this supports several concurrent events on the free tier; a large flagship event with many gates running alongside others is the point to consider the paid Blaze plan.

### 11.2 Performance Targets

| # | Requirement | Target |
|---|---|---|
| NFR1 | Scan to on-screen confirmation | under 2 seconds on venue Wi-Fi |
| NFR2 | Gate throughput | 6 attendees per minute per gate sustained |
| NFR3 | Concurrent gate devices | 4 without write contention |
| NFR4 | Attendee capacity | 500 per event with no redesign |
| NFR5 | Dashboard propagation | under 3 seconds from scan |
| NFR6 | Time computation | under 100 ms for 500 attendees and 5,000 scan events |
| NFR7 | Scanner usability | operable one-handed, outdoors, by a volunteer after a 2-minute briefing |
| NFR8 | Accessibility | keyboard navigable, 4.5:1 text contrast, labelled inputs, sound plus colour feedback |
| NFR9 | Mobile support | fully usable at 360 px width; body text never below 16 px |

NFR7 is a functional requirement, not a nicety. A scanner that needs interpretation produces a queue, a queue produces staff improvising, and improvisation produces bad data — which the backend will faithfully record as fact.

---

# SECTION 12
## Risk Register

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Attendee's QR unreadable — dead phone, cracked screen, glare, no smartphone | Queue halts | Manual name lookup in scanner; self-service page; printed QR fallback |
| R2 | Attendee forgets to scan out | Time overstated; certificate wrongly granted | Active-window close; `max_session_minutes` cap; scan-out reminder on self-service; review flag |
| R3 | Venue Wi-Fi fails at the gate | Cannot scan | Offline queue with local buffering and timestamp-preserving sync; paper backup plus admin insert as last resort |
| R4 | QR shared between students | Attendance fraud | Name displayed on every scan; one open session per token; contradictory patterns flagged. Residual — see 9.4 |
| R5 | EmailJS quota exhausted mid-event | Approved attendees never receive QR | Quota verified pre-event; self-service page is the guaranteed channel |
| R6 | RTDB connection limit reached | Gate scanner cannot connect | Self-service uses one-time reads; live listeners limited to staff surfaces |
| R7 | Minimum time set higher than countable hours | No one can qualify | Settings page computes and displays total countable hours and warns on conflict |
| R8 | Spam registrations on the public form | Administrator review burden | Throttling, CAPTCHA, bulk reject |
| R9 | Public read access to `/attendees` misconfigured | Student PII exposed | Rules deny public reads; rules test suite asserts this before deployment |
| R10 | Volunteer mis-scans direction | Wrong durations | Distinct colour and sound per direction; correction path with audit trail |
| R11 | Gate device clock wrong | Incorrect timestamps | Server timestamps enforced by validation rules |
| R12 | Attendee disputes final result | Credibility damage | Full scan log including rejections; self-service history; review request path |
| R13 | Single admin unavailable during event | Cannot approve or correct | At least two admin accounts provisioned before the event |
| R14 | Accidental data loss | Event record lost | JSON export of the database taken before the event and at each day's end |
| R15 | Admin acts on the wrong event while several are active | Approves or corrects the wrong attendees | Persistent active-event banner; every write is path-scoped to the selected event; destructive actions confirm the event name |
| R16 | Two concurrent events overlap in `/qr_index` | A scan resolves to the wrong event | Tokens are 128-bit random and globally unique across events; index write is admin-only at approval time |
| R17 | Free-tier limits shared across concurrent events | Connection or email quota exhausted faster with multiple active events | Section 11 limits are deployment-wide, not per event; monitor combined load; the 100-connection ceiling is the binding constraint when several events run at once |
| R18 | Proxy / shared QR across concurrent events — one person appears inside two events at once | Certificate credited without genuine attendance | Admin-side concurrent-overlap detection (Module 5) flags an email with open sessions in 2+ events over overlapping time; read-only, no new stored field; flags for review, does not block. Residual — physical ID checking is the only full close (9.4) |

---

# SECTION 13
## Deployment & Operations

Included because this system runs live at a real event, where there is no second attempt.

### 13.1 Pre-Event

- **Pilot first.** Run the system at a small internal event before a flagship one. Every failure mode in Section 12 is cheaper to discover with 20 attendees than 300.
- **Configuration review** — event type, QR validity, active windows, and minimum time verified by two people. R7 is a configuration error, not a code defect, so code review will not catch it.
- **Rules test suite** executed against the deployed rules, asserting in particular that the public cannot read `/attendees` (R9).
- **Staff accounts** created and tested on the actual gate devices.
- **Device check** — camera permission granted, PWA installed, screen brightness raised, battery banks on hand.
- **Database snapshot** exported (R14).
- **Volunteer briefing** — 10 minutes covering the scanner, the meaning of each colour and tone, name verification, the manual lookup path, and who to escalate to.
- **Attendee comms** — registration link, the certificate requirement stated up front, and a reminder that **scanning out is required**.

### 13.2 During the Event

- **Visible signage at the gate**: *"Scan IN when you enter. Scan OUT when you leave."* R2 is the most common data-quality problem, and it is caused by attendee behaviour, which signage addresses more effectively than any code.
- A designated system operator monitors the dashboard, not the gate.
- Review flags checked periodically, not left to the end.
- Daily snapshot export at the close of each active window on multi-day events.

### 13.3 Post-Event

- Reconciliation pass over open, capped, and flagged sessions.
- CSV and PDF export generated and archived.
- Disputes accepted through the self-service review path for a defined window.
- Personal data purged at the end of the retention period (Section 10).

---

# SECTION 14
## Testing & Acceptance

### 14.1 Test Coverage

| Level | Coverage |
|---|---|
| **Unit — time engine** | Every rule in Section 6: single session; multiple sessions; duplicate `in`; orphan `out`; open session at window end; session exceeding the cap; overnight exclusion; window-boundary arithmetic; corrections applied in order. This is the highest-value suite in the project — it is where a wrong certificate originates. |
| **Unit — eligibility** | Threshold boundaries at exactly, one minute under, and one minute over |
| **Integration** | Approve → token created → QR renders → scan accepted, end to end; CSV import with malformed rows; correction changes the derived total |
| **Security rules** | Public cannot read `/attendees`; public cannot write `status` or `qr_token`; gate staff cannot read the roster; nobody can delete a scan event; expired and revoked tokens rejected |
| **Multi-event isolation** | A request scoped to Event 2 cannot read Event 1's attendees or scans; a token for Event 1 resolves only to Event 1; editing one event does not alter another; two events with overlapping active windows keep independent totals |
| **Concurrent-overlap detection** | An email with open sessions in two active events over overlapping time is flagged `concurrent_overlap`; the same email inside one event at a time is not flagged; the check writes nothing to any event's scan data |
| **Concurrency** | Two gates scanning one attendee simultaneously produce exactly one state change; two events active at once record scans to their own subtrees without interference |
| **Resilience** | Offline queue buffers and syncs with original timestamps preserved; duplicate submission on reconnect does not double-count |
| **Field / usability** | Camera performance in daylight, low light, and against a phone screen; throughput against a simulated 50-person queue; volunteer operating the scanner after only the standard briefing |
| **Accessibility** | Keyboard navigation, contrast audit, screen-reader labels, feedback legible without colour |

The security and concurrency suites warrant particular attention because their failures are **silent** — they produce plausible-looking data rather than visible errors, so nothing prompts an investigation.

### 14.2 Acceptance Criteria

The system is accepted when:

1. An unapproved registration cannot obtain a working QR by any client-side means, including direct database writes.
2. The public registration page cannot read any other attendee's personal data.
3. A QR scanned repeatedly alternates IN → OUT correctly, and repeat reads within 5 seconds are ignored without corrupting state.
4. An attendee with three separate visits shows a total equal to the sum of the countable portions of all three, verifiable by hand from the scan log.
5. An attendee who stays overnight without scanning out is credited only for time inside declared active windows.
6. An attendee still inside at event end has their session closed at the final window's end and appears with a complete total.
7. The dashboard headcount matches a manual count of open sessions at any moment.
8. A gate staff account, querying the database directly, cannot read the attendee roster or delete a scan event.
9. Lowering the minimum time after the event immediately re-evaluates every attendee, with no migration step.
10. Every administrator correction appears in the audit trail with actor, timestamp, and written reason, and the original scan event remains intact.
11. CSV and PDF exports both generate with complete per-attendee totals and no null durations.
12. A student can retrieve their QR and see their accumulated time without any email being received.
13. The scanner continues to accept scans through a simulated 60-second network outage and syncs correctly on reconnect.
14. With two events active at once, a QR issued for Event 1 scanned at a gate resolves to Event 1's data, records under Event 1, and never appears in Event 2's dashboard, export, or attendee list.
15. An attendee registered in Event 1 cannot be read by any request scoped to Event 2, including a direct database query.
16. Creating, editing, or archiving one event leaves every other event's data byte-for-byte unchanged.
17. With three events active at once, an email holding an open session in two or more of them over overlapping time is flagged `concurrent_overlap` under Needs review, and clearing an overlap in one event removes the flag without writing to any event's scan data.

Criterion 5 is the one that would fail under the original proposal. Criterion 12 is the one that makes the system usable by students in practice. Criteria 14–16 are what make concurrent multi-event safe. Criterion 17 is what catches proxy attendance across concurrent events (R18).

---

# SECTION 15
## Development Timeline

Seven weeks, extended from six. The additional week covers the time-engine test suite and the security-rules suite — the two areas where a defect produces a wrong certificate rather than a visible bug, and therefore the two that cannot be verified by clicking through the UI.

| Week | Phase | Deliverables |
|---|---|---|
| **1** | Planning & Setup | Firebase project, **multi-event database structure (`/events/{eventId}/` + global `/staff`, `/qr_index`)**, **security rules with per-event isolation and test suite**, Auth with admin/staff roles, event-management + switcher UI, design system, project scaffolding |
| **2** | Time Engine | Pure time-computation module, active-window logic, session reconstruction, corrections application, **full unit test suite** — built and proven before any UI depends on it |
| **3** | Registration | Event-scoped public form with consent, admin approval queue, QR generation on approval with `/qr_index` write, EmailJS integration, bulk CSV upload, claim-token self-service link |
| **4** | Gate Scanner | Camera scanning, cooldown, direction resolution, expiry and revocation checks, offline queue, manual lookup, feedback UI with colour and sound |
| **5** | Dashboard & Settings | Live dashboard, live timers, statistics bar, paginated scan log, settings page with countable-hours validation, corrections tool |
| **6** | Self-Service & Export | Student portal (QR, status, progress, history, review request), eligibility view, reconciliation check, CSV export, PDF export |
| **7** | Testing & Deployment | Integration, concurrency, resilience, accessibility, and field testing; volunteer documentation; **pilot event**; Firebase Hosting deployment |

Building the time engine in week 2, before the scanner or dashboard exists, is deliberate. Every screen in the system displays numbers this module produces. If it is written last, or written inside a React component, its rules become entangled with UI state and can only be tested by clicking — which is exactly how the edge cases in Section 6.4 escape notice until an event is over.

---

# SECTION 16
## Expected Output

On completion the system will deliver:

- A fully functional web application accessible by browser on any device
- **Multi-event capability** — one deployment managing many events, several able to run concurrently, with each event's data fully isolated under its own path and one admin team switching between them
- Public registration page with self-registration, consent capture, and admin approval workflow
- Automated QR ticket email delivery on approval, with a guaranteed self-service retrieval path
- Real-time gate scanner using the device camera, with automatic IN/OUT detection, offline resilience, and manual fallback
- **A tested, documented time computation engine** implementing the countable-hours model and every edge case in Section 6
- Live administrator dashboard with per-attendee running timers, live headcount, and anomaly review flags
- **Student self-service portal** for QR retrieval, live eligibility progress, scan history, and review requests
- Configurable certificate eligibility engine supporting Hackathon, Seminar, and Workshop formats
- Configurable QR validity window and active-hours schedule
- Administrator correction tools with a complete, append-only audit trail
- Post-event attendance report exportable as analytical CSV and PDF, with pre-export reconciliation
- **CertFlow-ready CSV export** (`name,email`, eligible-only) that feeds the group's certificate generator directly, completing the registration → certificate pipeline
- Firebase-powered backend with **enforced role-based security rules** and real-time multi-device sync
- Data privacy controls aligned with RA 10173 and STI College policy
- Volunteer operating guide and administrator runbook

The system is designed for live deployment at events organized by the AWS Student Builder Group at STI College Global City, Taguig, serving as a reusable platform for future academic and community events.

---

# SECTION 17
## Conclusion

The Event Attendee Time Tracking and Certificate Eligibility System addresses a real operational problem in academic and community events. Replacing manual attendance with QR-based gate tracking on a Firebase real-time backend delivers accuracy, transparency, and administrative efficiency.

Because this platform will be deployed for actual use rather than demonstrated once, this plan treats three concerns as first-class rather than incidental.

**Correctness under scrutiny.** The system's output decides whether a student receives a certificate. It therefore stores only raw scan events and derives every reported figure from them, keeps an append-only log that includes failures and corrections, and defines explicitly how overnight periods, missed scans, and open sessions are treated. Any result the system reports can be traced to the records that produced it and explained to the student it concerns.

**Usability for the people who actually touch it.** Attendees are one-time users who will not create accounts, may not receive the email, and will sometimes forget to scan out. Gate staff are volunteers working a queue. The self-service portal, the glanceable scanner feedback, and the manual fallback paths exist because these are the conditions the system will meet, not the conditions it would prefer.

**Protection of student data.** The system collects personal information from students, and its access rules, consent capture, and retention policy are built to that standard from the start rather than retrofitted.

The configurable design — multiple event types, adjustable time requirements, flexible validity and active-hours windows — makes the platform reusable across future events. The hybrid registration model ensures only approved participants receive access while reducing manual data entry.

This project reflects the integration of React.js, Firebase, QR scanning, and automated email delivery into a coherent, purpose-built tool serving academic event organizers and participants. It stands as a practical contribution of the AWS Student Builder Group to the academic community of STI College Global City.

---

# Revision Notes

Changes from the Project Proposal, and the reason for each.

### Corrected

| # | Issue in proposal | Resolution |
|---|---|---|
| 1 | **The 16-hour Hackathon threshold is unachievable fairly.** A Sep 16 10:00 → Sep 18 22:00 window spans 60 hours. An attendee sleeping at the venue accumulates 60 hours; one who properly scans out each night accumulates about 24. Honest behaviour is penalized. | Active-window model (6.2) credits only declared event hours |
| 2 | **No rule for a forgotten exit scan.** Under stored-timer accumulation, an unclosed session runs indefinitely, making the omission look like maximum attendance. | Window-end close plus `max_session_minutes` cap (6.4) |
| 3 | **`is_eligible` stored in a client-writable database.** The stack has no server code, so a browser must write it — and the users are computing students. | Eligibility derived at read time; the field no longer exists in storage (5.3) |
| 4 | **No scan cooldown.** Camera decoders fire several times per second, so one presentation would register IN then OUT and silently freeze the attendee's total. | 5-second cooldown per token, logged (Module 4) |
| 5 | **Public registration needs write access to `/attendees`; without a read rule denying it, every attendee's name and email is readable by anyone.** | Rules deny public reads; asserted in the test suite (9.2, R9) |
| 6 | **`sessions` as an array.** Concurrent writes to array indices in Realtime Database can overwrite one another. | Push-ID keyed `scan_events` (5.4) |
| 7 | **Rejected scans not logged**, leaving the most common support question unanswerable. | All outcomes recorded, including rejections (5.4) |
| 8 | **Device clocks used for timestamps.** Phone clocks are routinely minutes off. | Server timestamps enforced by validation rules (6.5, 9.3) |
| 9 | **EmailJS as sole delivery path**, with a ~200/month free quota and routine spam filtering. | Self-service retrieval guarantees access; quota documented (11.1) |
| 10 | **No timezone specification** for a multi-day event crossing midnight. | Absolute timestamps with `+08:00` (6.5) |
| 11 | **Single admin role**, giving gate volunteers access to all student PII. | Separate `gate_staff` role, scanner-only (3, 9.2) |
| 12 | **No correction path**, so a genuine error was unfixable and any fix would be unauditable. | Append-only corrections with required reason (Module 5) |

### Added

- **Multi-event architecture (B1 model).** The proposal was single-event per instance, requiring a separate deployment for every event. This version makes the system multi-event: many events from one deployment, several able to run concurrently, each event's data isolated under `/events/{eventId}/`, one shared admin team. Delivered as a scoping change over the derived-state design, so no time or eligibility logic was disturbed. Added Module 0 (event management + switcher), the global `/qr_index`, per-event security rules, and multi-event tests. See Sections 5.4, 5.5, 9.2.
- **Section 6 — Time Computation Model.** The core logic of the system, previously undefined.
- **Module 7 — Student Self-Service Page.** Attendees see their progress during the event, when a missed scan can still be fixed.
- **Section 10 — Data Privacy.** RA 10173 obligations for collecting student data.
- **Section 10A — Ecosystem & Integrations.** Evaluated Luma for registration (rejected: paid webhooks, external QR dependency, no added value, extra failure mode) and adopted CertFlow for certificate distribution via a `name,email` eligible-only CSV handoff, completing the register → certificate pipeline.
- **Section 11 — Capacity & Quotas.** Free-tier limits, including the 100-connection ceiling that a naively built self-service page would consume at the gate's expense.
- **Section 12 — Risk Register.** 18 risks with mitigations, including four specific to concurrent multi-event.
- **Section 13 — Deployment & Operations.** Pilot event, volunteer briefing, gate signage, snapshots.
- **Section 14 — Testing & Acceptance.** 17 acceptance criteria, including multi-event isolation and concurrent-overlap detection.
- **Concurrent-attendance overlap detection (Module 5).** An admin-side, read-only flag that catches one email holding an open session in two or more concurrent events at once — proxy / shared-QR attendance made visible. Writes nothing; introduces no global person record; flags for review, does not block (R18, criterion 17).
- **One-click CertFlow shortcut (Module 6).** A configurable "Open CertFlow" link beside the CertFlow-ready CSV export, pointing at the deployed app (`awsc-certificate-automation.streamlit.app`). Shortens the handoff without merging codebases — the coupling stays the CSV.
- **Offline scan queue**, promoted from a stated limitation to a built feature.
- **Manual name lookup** at the gate.
- **Pre-export reconciliation** to surface anomalies before certificates are issued.
- **Timeline extended to 7 weeks**, with the time engine built and tested in week 2 before any UI depends on it.

### Open Decisions

1. **Active windows per event type** — confirm the default schedule for a typical STI hackathon, seminar, and workshop.
2. **Retention period** — 90 days assumed; confirm against STI College policy.
3. **Grace allowance** — should an attendee be credited a short grace period for a late scan-in, or is the scan time absolute?
4. **Partial certificates** — is there a second, lower tier for attendees who fall short, or is eligibility strictly binary?
5. **Number of gates** — one entrance or several? Affects device count and volunteer staffing.
6. **EmailJS quota** — confirm the current plan's monthly limit against expected attendee volume.
7. **Per-organizer access (future)** — the current model (B1) gives every admin access to every event. If different STI orgs should each see only their own events, that is true multi-tenancy (the B2 model), a larger security change deferred to a later version. Confirm whether this is needed soon or genuinely later.
