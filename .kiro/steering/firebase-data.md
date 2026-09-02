---
inclusion: auto
name: firebase-data
description: Auto-include when working on Firebase Realtime Database, the data model, security rules, qr_index, staff nodes, attendee/scan_events/corrections structure, auth roles, or multi-event data isolation.
---

# Firebase & data-model guidance (Sections 5, 8, 9 of the plan)

Follow `PROJECT_PLAN.md` Sections 5 and 9 and `CLAUDE_BUILD_BRIEF.md` Sections 5 and 8 exactly.

## Data model (RTDB — JSON tree, push IDs, NO arrays)

- All event-owned data under `/events/{eventId}/`: `meta`, `settings`, `attendees/{id}`,
  `scan_events/{id}` (append-only), `corrections/{id}` (append-only).
- Global nodes only: `/staff/{uid}` (role: admin | gate_staff) and `/qr_index/{qr_token}` →
  `{ event_id, attendee_id }`.
- Never use arrays for concurrently-written paths — push IDs only (concurrent gate writes collide).
- Store rejected scans too (needed to answer "I scanned, why no time?").

## Derived state (inviolable)

`total_time_minutes`, `current_status`, `is_eligible` DO NOT EXIST in storage. If a task implies
writing them, stop — they are derived by the time engine at read time.

## Credentials

- `qr_token` and `claim_token` are 128-bit crypto-random, NEVER derived from name/email/id.
- A `qr_token` exists ONLY after admin approval. `/qr_index` is written by admin at approval time only.
- Revocation is immediate; re-issue invalidates the prior token.

## Security rules (enforce in rules, not UI)

- Public: create pending attendee only; NO read of `/attendees`; cannot write status/qr_token/approval fields.
- Gate staff: append scan_events only; read via token lookup; cannot read the roster; cannot delete scans.
- Admin: full within an event; still cannot delete scan_events (append-only for everyone).
- Isolation is by PATH — a rule on one event grants nothing on another.
- Validate: `scanned_at` must equal server timestamp; `direction`/`outcome` in allowed sets.
- Ship a rules test suite; it MUST assert the public cannot read `/attendees`.

## Quotas to design around

Spark free tier: 100 simultaneous connections (shared across concurrent events). Self-service pages
use ONE-TIME READS; live listeners are reserved for admin dashboard + gate devices only.

## Secrets

Firebase config in `.env` (`VITE_`-prefixed). Commit only `.env.example` with placeholders.
