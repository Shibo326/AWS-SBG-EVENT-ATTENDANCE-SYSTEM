// EmailJS integration — client-side QR ticket delivery on approval.
// Implements the email side of Module 2 (Brief §7) and the stack row in
// PROJECT_PLAN §5.1 / §9.4.
//
// Design notes tied to the plan:
//   • EmailJS is client-side by design, so its public key ships in the bundle.
//     That is acceptable here: the key is DOMAIN-RESTRICTED in the EmailJS
//     dashboard (§9.4), and nothing security-critical depends on it staying
//     secret — eligibility lives in the derived-state model + Firebase rules.
//   • Email is a CONVENIENCE channel, never the sole path to a QR. The
//     self-service page (Module 7) guarantees retrieval when email fails
//     (§4 limitations, §12.12). So a send failure here must NOT block approval.
//   • Config comes from VITE_-prefixed env vars (never hard-coded). When they
//     are absent (local dev, tests), every function no-ops gracefully and says
//     so, so the rest of the app runs without EmailJS wired up.
//
// EmailJS free tier is ~200 emails/month (§11) — callers that send in bulk
// (CSV import approval) should throttle; see sendQrTicket's return contract.

import emailjs from '@emailjs/browser'
import QRCodeLib from 'qrcode'

// Read config at call time (not captured at import) so tests can stub the env
// and so a dev-server .env change is picked up on reload without stale module
// state. These are cheap property reads.
const cfg = () => ({
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
})

/** True only when all three EmailJS settings are present. */
export function isEmailConfigured() {
  const { serviceId, templateId, publicKey } = cfg()
  return Boolean(serviceId && templateId && publicKey)
}

let initialized = false
function ensureInit() {
  if (initialized || !isEmailConfigured()) return
  emailjs.init({ publicKey: cfg().publicKey })
  initialized = true
}

/**
 * Render an attendee's QR token to a PNG data URL for embedding in an email.
 * Uses the same `qrcode` library the UI renders with, so the emailed code and
 * the on-screen code are identical.
 */
export async function renderQrDataUrl(qrToken, size = 320) {
  return QRCodeLib.toDataURL(qrToken, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'M',
  })
}

/**
 * Build the self-service URL an approved attendee uses to retrieve their QR
 * without relying on email arriving (§12.12). Origin is taken from the running
 * app; falls back to a relative path in non-browser contexts (tests).
 */
export function claimUrl(claimToken) {
  const origin =
    typeof window !== 'undefined' && window.location ? window.location.origin : ''
  return `${origin}/me/${claimToken}`
}

/**
 * Send a QR ticket email to an approved attendee.
 *
 * @param {object} args
 * @param {string} args.toEmail       recipient
 * @param {string} args.toName        attendee full name
 * @param {string} args.eventName     event display name
 * @param {string} args.qrToken       the minted 128-bit token (post-approval)
 * @param {string} [args.claimToken]  self-service token, for the retrieval link
 * @param {object} [args.extra]       extra template params (venue, window, etc.)
 * @returns {Promise<{sent:boolean, skipped?:boolean, reason?:string, error?:any}>}
 *
 * NEVER throws: a delivery failure must not block approval (the self-service
 * page is the guaranteed fallback). Callers inspect the returned `sent` flag.
 */
export async function sendQrTicket({ toEmail, toName, eventName, qrToken, claimToken, extra = {} }) {
  if (!isEmailConfigured()) {
    return { sent: false, skipped: true, reason: 'EmailJS not configured (VITE_EMAILJS_* unset)' }
  }
  if (!toEmail || !qrToken) {
    return { sent: false, skipped: true, reason: 'Missing recipient email or QR token' }
  }

  try {
    ensureInit()
    const { serviceId, templateId } = cfg()
    const templateParams = {
      to_email: toEmail,
      to_name: toName || '',
      event_name: eventName || '',
      // A HOSTED https image URL — NOT a base64 data URL. Gmail and most email
      // clients refuse to render `src="data:..."` images, which is why the
      // emailed QR showed as a broken image. A remote https image renders
      // reliably. Reference as `<img src="{{qr_image}}">` in the template.
      qr_image: qrImageUrl(qrToken),
      claim_url: claimToken ? claimUrl(claimToken) : '',
      ...extra,
    }
    await emailjs.send(serviceId, templateId, templateParams)
    return { sent: true }
  } catch (error) {
    // Swallow — approval proceeds; the attendee can still use self-service.
    return { sent: false, error }
  }
}

/**
 * A public https URL that renders the QR token as a PNG, suitable for email
 * (unlike a base64 data URL, which email clients block). Uses a stateless QR
 * image service — the token is unguessable (128-bit), so exposing it in a URL
 * leaks nothing useful beyond what the QR itself contains. The self-service
 * page remains the guaranteed fallback if the image is ever blocked.
 */
export function qrImageUrl(qrToken, size = 300) {
  const data = encodeURIComponent(qrToken)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`
}
