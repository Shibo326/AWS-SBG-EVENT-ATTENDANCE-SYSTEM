---
inclusion: always
---

# Plan is the Source of Truth (read-only)

This workspace builds the **AWS Student Builder Group — STI College Global City**
QR-powered event attendance & certificate-eligibility system. It is a **software/system
project**; it is NOT a hackathon entry. "Hackathon / seminar / workshop" are only the three
**event formats the system supports**, never the project's context or deadline.

## The two planning documents are authoritative

- `PROJECT_PLAN.md` — the full, detailed plan (source of truth for all edge cases, the time
  model, security, privacy, quotas, acceptance criteria).
- `CLAUDE_BUILD_BRIEF.md` — the condensed, build-oriented version of the same plan.

## Non-negotiable rules for every agent and every change

1. **Follow the plan. Never shrink, weaken, contradict, or silently redesign it.** If a change
   would deviate from either document, STOP and confirm with the user first — explain the
   deviation and why. Do not "simplify away" a documented requirement.
2. **Do not edit `PROJECT_PLAN.md` or `CLAUDE_BUILD_BRIEF.md`** unless the user explicitly asks
   to change the plan itself. Treat them as read-only references while implementing.
3. **The derived-state rule is inviolable.** Only raw scan events are stored. `total_time_minutes`,
   `current_status`, and `is_eligible` are DERIVED at read time and never written to the database.
4. **Timestamps are server timestamps** (`+08:00`), never device clocks. Displayed in Asia/Manila.
5. **`scan_events` is append-only for everyone, including admins.** Corrections are appended, never
   overwrites.
6. **Event data is isolated by path** under `/events/{eventId}/`. `/staff` and `/qr_index` are the
   only global nodes.
7. **Security lives in Firebase rules + the data model, not in UI code.** Public can never read
   `/attendees`.
8. **Secrets go in `.env`** (`VITE_`-prefixed), never committed. Keep `.env.example` with placeholders.
9. **TDD:** for logic that affects certificates (time engine, eligibility), write failing tests
   first, then code. The time engine is built and proven before any UI consumes it.
10. **Match existing conventions:** React function components, Tailwind, react-router. Don't
    introduce new frameworks/state libraries without asking.

## Current project state (keep in mind)

React 18 + Vite 5 + Tailwind 3 + react-router 6 are installed. Routing and 9 stub pages exist
under `src/pages/`. Firebase, QR libraries, EmailJS, and a test framework are NOT installed yet.
`src/lib/` and `src/components/` are empty.

## When in doubt

Ask a short clarifying question rather than assuming. Deviating from the plan without confirmation
is a failure, even if the alternative seems simpler.
