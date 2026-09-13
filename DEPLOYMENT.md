# Deployment & Handoff — AWS SBG Event Attendance System

This document is for the project head taking the system to a live event. It states
what is built, what is already live, what must be done before go-live, and the
known limitations. It is a companion to `README.md` (feature overview) and
`PROJECT_PLAN.md` (the authoritative plan).

Last updated as of the Firebase backend cutover + the four resilience features
(offline queue, bulk CSV import, forced reconciliation, registration guard).

---

## 1. What is built and working

All plan modules (0–7) are implemented and run against a **live Firebase Realtime
Database**. Automated test suite passes (72 tests: time engine, security-rule
invariants, email module, concurrent-overlap, offline queue, CSV parsing,
registration guard). Production build is clean.

| Area | Status |
|---|---|
| Time engine (sessions, active windows, countable minutes, derived eligibility) | ✅ built + unit-tested |
| Firebase Realtime Database data layer + async hooks | ✅ live |
| Firebase Auth + `/staff` roles (admin / gate_staff) with login gates | ✅ live |
| Security rules (`database.rules.json`) | ✅ deployed |
| Public registration + consent + duplicate-email check | ✅ |
| Registration approval (single + bulk), QR mint, `/qr_index` write | ✅ |
| Bulk CSV attendee import (preview + per-row validation) | ✅ |
| EmailJS QR-ticket delivery on approval | ✅ (see deliverability note below) |
| Gate scanner (`html5-qrcode`, 5s cooldown, IN/OUT, manual lookup) | ✅ |
| Offline scan queue (buffer on outage, timestamp-preserving sync) | ✅ + tested |
| Live dashboard (timers, stats, scan log, corrections tool) | ✅ |
| Concurrent-overlap detection (R18 — proxy/shared-QR flag) | ✅ |
| Event settings (active windows, countable-hours validation) | ✅ |
| Student self-service (QR retrieval, progress, history, review request) | ✅ |
| Forced pre-export reconciliation | ✅ |
| Export: analytical CSV + CertFlow CSV + PDF report | ✅ |

---

## 2. What is already live on Firebase

- **Project:** `event-attendance-system-b380c` (Realtime Database in `asia-southeast1`).
- **Security rules** are deployed (`firebase deploy --only database`).
- **One admin account** exists in `/staff` (the club/admin login). There is no
  backup admin — see risk in §5.
- **Two demo events** were seeded for testing. Remove or archive them before the
  real event if you don't want them in the dashboard.

---

## 3. Pre-launch checklist (project head)

These require account/console access and cannot be done from the codebase.

### Security (do before ANY real attendee data is entered)
- [x] **Admin password rotated** — the original bootstrap password was exposed
      during setup and has been changed.
- [x] **EmailJS private key regenerated** — the original was exposed and has been
      rotated. (The app does not use the private key; nothing breaks.)
- [ ] **Domain-restrict the EmailJS public key** — EmailJS dashboard →
      Account → Security → allowlist the production domain (and `localhost` for
      testing). The public key ships in the browser bundle by design; domain
      restriction is its protection.
- [ ] **Behavioral security-rules tests** — verify against the Firebase Emulator
      that gate_staff genuinely cannot read the roster and non-admins cannot
      write admin-only fields (acceptance criterion 8). Java (JDK) is required;
      it is installed on the dev machine. Uses `@firebase/rules-unit-testing`.

### Hosting
- [ ] **Deploy to HTTPS** (Firebase Hosting or Vercel). The app must run over
      HTTPS in production — the device camera (scanner) and clipboard APIs
      require a secure context, so a plain `http://` LAN address will not work
      for the gate scanner. `.env` values are read at build time; set them in
      the host's environment / build config.

### Email deliverability
- [ ] **Fix spam flagging** — QR emails currently land in spam (EmailJS free tier
      from an STI address; reputation-based). Set up SPF/DKIM on the sending
      domain, or move to a transactional email service. Until then, rely on the
      **self-service link** (it always renders the QR and is the plan's
      guaranteed retrieval path). The emailed QR itself uses a hosted image URL
      so it renders in email clients.

### Data privacy (Data Privacy Act / RA 10173)
- [ ] **Plan the ~90-day PII retention purge** (PROJECT_PLAN §10). There is no
      automated purge yet — it is currently a manual action. A scheduled Cloud
      Function is the natural home but requires the paid Blaze plan.

---

## 4. Environment / secrets

- Secrets live in `.env` (gitignored, `VITE_`-prefixed). It is **not** committed.
- `.env.example` (committed) lists every required key with placeholders.
- The **Firebase web API key** and **EmailJS public key** are public-by-design
  (they identify the project; security comes from the rules + domain restriction,
  not secrecy of these values).
- The **EmailJS private key is not used** in this client-only app and must never
  be added to `.env` or the code — it would ship to the browser.

Required `.env` keys:
```
VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_DATABASE_URL,
VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET,
VITE_FIREBASE_MESSAGING_SENDER_ID, VITE_FIREBASE_APP_ID,
VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY
```

---

## 5. Known limitations & risks (be aware, not necessarily blockers)

- **Firebase free (Spark) tier: 100 simultaneous connections, shared across ALL
  concurrent events.** A connection = any open live listener (admin dashboards,
  gate devices). Self-service uses one-time reads and does not count. One event
  with a few gates is well within budget; many concurrent events with many gates
  + admin tabs can hit the ceiling — that is the point to consider the Blaze
  plan (PROJECT_PLAN §11).
- **EmailJS free tier ~200 emails/month.** A 500-person event exceeds it; verify
  quota pre-event. Self-service covers overflow.
- **Single admin account, no backup.** If that account is lost/deleted, there is
  no second admin to restore access; re-bootstrapping requires creating a new
  Auth user and writing its `/staff` node in the console. Consider adding a
  second admin before the event.
- **Registration throttle is per-browser, not per-IP.** True per-IP needs a
  server; the client-side limit is a speed bump. Real integrity is admin
  approval before any QR is issued.
- **Proxy attendance** (shared QR) cannot be fully prevented client-side.
  Mitigated by: name shown on every scan, one open session per token,
  concurrent-overlap review flag. Only physical ID checking closes it — a
  staffing decision (PROJECT_PLAN §9.4).
- **Offline queue uses the device clock** for the captured scan time while
  offline (server timestamps are used when online). Check gate-device clocks
  before the event so buffered scans get accurate times.
- **Camera reliability** depends on device + lighting. Manual name lookup is the
  fallback; brief volunteers on it (the 2-minute briefing the plan assumes).

---

## 6. Running locally (for testing)

```bash
npm install
npm run dev          # dev server at http://localhost:8080
npm run test:run     # run the full test suite once
npm run build        # production build
firebase deploy --only database   # deploy security rules (Firebase CLI, logged in)
```

Sign in at `/admin` with the admin account. Routes and access levels are in
`README.md`.

---

## 7. Acceptance-criteria status (PROJECT_PLAN §14)

Implemented and covered by automated tests or verified behavior: criteria 1–7,
9–14, 16, 17. **Criterion 8** (gate staff cannot read the roster / cannot delete
a scan via direct DB access) is enforced by the deployed rules but has **not** been
behaviorally tested against the live backend — this is the "behavioral rules
tests" item in §3. **Criterion 15** (cross-event isolation on a direct query) is
enforced by path-based rules and verified for public reads; the authenticated
cross-event case shares the same §3 verification gap.

---

*Prepared as the engineering handoff for the AWS Student Builder Group — STI
College Global City. Treat `PROJECT_PLAN.md` as the source of truth where any
detail here is ambiguous.*
