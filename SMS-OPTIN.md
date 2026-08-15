# SMS Opt-In — verifiable double opt-in consent capture

*The front door to a compliant SMS program. SMS marketing is lawful only with the recipient's verifiable prior
express consent (TCPA) — and the compliant version IS user opt-in. This captures it properly and stores durable
proof. It does NOT send any SMS: actual sending still requires the `sms_marketing` flag ON plus a real provider.
Not legal advice.*

## How it works

- The user submits their mobile number and explicitly checks the consent language (`SMS_OPTIN_DISCLOSURE`).
  A **pending** consent record is stored with the exact disclosure shown, a timestamp, and the IP.
- **Double opt-in:** a confirmation step flips it to **confirmed** with its own timestamp (the user replying
  YES / clicking the confirmation link once delivery is switched on).
- **STOP / revoke** marks consent revoked immediately — honoring opt-out is mandatory and always succeeds.
- Off by default per user; consent is explicit, and "consent is not a condition of purchase."

## What this does and doesn't do

It makes the CONSENT real and auditable so the SMS path can be turned on lawfully. It does not itself send
texts — delivering the confirmation and any marketing needs a provider (e.g. Twilio) and the `sms_marketing`
flag, which stays OFF until that + counsel are in place.

## Where it lives in code

- Flag: `sms_optin_capture` (ON) — capture only; `sms_marketing` (sending) stays OFF.
- Setting: `SMS_OPTIN_DISCLOSURE`.
- Model: `backend/sdk/sms-optin.ts` — config, `normalizePhone`, `currentConsent`, `consentView`.
- Entity: `ConsentRecord` (existing), `kind = "sms_marketing"`.
- Functions: `smsOptInStatus`, `smsOptInRequest`, `smsOptInConfirm`, `smsOptInRevoke`.
- UI: `src/components/SmsOptInButton.jsx` — drop onto a settings/profile page.
