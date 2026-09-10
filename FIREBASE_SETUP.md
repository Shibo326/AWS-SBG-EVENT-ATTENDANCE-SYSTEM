# Firebase Setup — run the app live

This branch (`firebase-integration`) talks to a real Firebase Realtime Database.
Follow these steps once to point it at a project and sign in as an admin. Steps 1–4
happen in the Firebase Console (you must be logged into your Google account — this
part cannot be automated for you). Steps 5–7 are local.

---

## 1. Create (or open) the Firebase project

1. Go to <https://console.firebase.google.com> and **Add project** (or open the
   existing `event-attendance-system-b380c` referenced in `.firebaserc`).
2. Analytics is optional — the app does not use it (Data Privacy Act, §10).

## 2. Create a Realtime Database

1. Left menu → **Build → Realtime Database → Create database**.
2. Location: pick **Singapore (asia-southeast1)** — closest to PH.
3. Start in **locked mode** (we deploy real rules in step 6).
4. Copy the database URL — looks like
   `https://<project>-default-rtdb.asia-southeast1.firebasedatabase.app`.

## 3. Enable Email/Password auth

1. **Build → Authentication → Get started**.
2. **Sign-in method → Email/Password → Enable → Save.**
3. **Users → Add user**: create your admin login, e.g. `admin@awssbg.dev` + a
   password. **Copy the User UID** it generates — you need it in step 7.

## 4. Register a Web App and copy the config

1. Project settings (gear icon) → **Your apps → Web (`</>`)** → register app.
2. Copy the `firebaseConfig` values (apiKey, authDomain, databaseURL, projectId,
   storageBucket, messagingSenderId, appId).

## 5. Create your local `.env`

Copy `.env.example` to `.env` and fill in the values from step 4:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://<project>-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_STORAGE_BUCKET=<project>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

EmailJS keys (step 8) are optional to start — approval still works, only the QR
email won't send until they're set. The self-service page is the guaranteed QR
channel regardless (§11).

`.env` is gitignored — never commit it.

## 6. Deploy the security rules

The rules in `database.rules.json` are the real access boundary. Deploy them:

```bash
npm install -g firebase-tools     # once
firebase login                    # once, opens a browser
firebase use <your-project-id>    # or edit .firebaserc
firebase deploy --only database
```

Until these are deployed, the locked-mode default denies everything and the app
will show permission errors.

## 7. Bootstrap the first admin (chicken-and-egg fix)

Only an admin can write `/staff`, but you have no admin record yet. Seed one with
the helper script (uses the UID from step 3):

```bash
node scripts/seed-admin.mjs <YOUR_ADMIN_UID> "Admin Name" admin@awssbg.dev
```

It writes `/staff/<uid> = { role: "admin", active: true, ... }` using the
Firebase REST API and your database URL from `.env`. Run it while the database
is briefly open, OR paste the same node by hand in the Console (see the script
header for the exact JSON). After this you can add all other staff from the app.

## 8. (Optional) EmailJS for QR ticket delivery

1. Create a free account at <https://www.emailjs.com>.
2. Add an email service + a template whose body includes the QR image and the
   attendee's name. Note the **service id**, **template id**, **public key**.
3. Put them in `.env` (`VITE_EMAILJS_*`).
4. Domain-restrict the public key in the EmailJS dashboard (§9.4).

## 9. Run it

```bash
npm install
npm run dev
```

- Open the app → you'll hit the **staff sign-in** screen → log in with the
  account from step 3.
- `/admin` → create an event, open registration, approve an attendee (mints a
  QR), then open `/scan` to scan.
- `/register/<eventId>` is the public form; `/me/<claimToken>` is self-service.

## Troubleshooting

- **Stuck on the sign-in screen after logging in / "No access":** your
  `/staff/<uid>` record is missing or `active: false`. Redo step 7 with the
  correct UID (Authentication → Users → copy UID).
- **Permission denied / null data everywhere:** rules not deployed (step 6) or
  `VITE_FIREBASE_DATABASE_URL` wrong.
- **`[firebase] Missing config` in console:** `.env` not filled or dev server
  not restarted after editing `.env` (Vite reads env at startup).
- **QR email not arriving:** EmailJS not configured or over its ~200/month free
  quota — use the self-service page to retrieve the QR (§11).
