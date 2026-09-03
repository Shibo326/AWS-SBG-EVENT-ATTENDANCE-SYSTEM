---
inclusion: auto
name: time-engine
description: Auto-include when working on time computation, sessions, active windows, countable hours, certificate eligibility, the time engine, or anything in src/lib that sums attendee time or decides who is eligible.
---

# Time Engine guidance (Section 6 of the plan)

Applies whenever the work touches how attendee time is computed or how eligibility is decided.
Follow `PROJECT_PLAN.md` Section 6 and `CLAUDE_BUILD_BRIEF.md` Section 6 exactly. Do not simplify
the model.

## Ground rules

- **Pure functions, no I/O, no React state.** Live in `src/lib/` (e.g. `timeEngine.js`). The engine
  takes data in and returns numbers out; it never reads Firebase or renders UI.
- **Derived, never stored.** `total_minutes`, `is_inside`, `is_eligible` are computed on read. There
  is no stored eligibility field to write.
- **TDD is mandatory here** — this is where a wrong certificate originates. Write a failing test for
  each behavior first, watch it fail for the right reason, then implement.

## The algorithm (do not deviate)

- A session = an accepted `in` followed by an accepted `out`, in chronological order.
- Credit time ONLY for the overlap with declared `active_windows` (`countableMinutes`).
- `in` while already open → ignored (no double-open). `out` while not open → ignored (no negative).
- Open session at read time → close at `min(now, end of current/last active window, open + max_session_minutes)`.
- Add `adjust_minutes` corrections to the total.

## Edge cases the tests MUST cover

single session; multiple sessions; duplicate `in`; orphan `out`; open session at window end; session
exceeding `max_session_minutes` (flag for review); overnight exclusion; window-boundary arithmetic;
corrections applied in order; threshold boundaries at exactly / one under / one over.

## Timezone

Absolute timestamps with `+08:00`, sourced from Firebase server timestamp. Display/export in
Asia/Manila. Never trust device clocks.

## Performance

Under 100 ms for 500 attendees and 5,000 scan events. It's plain arithmetic; keep it that way.
