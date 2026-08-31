# Counsel note — step-up authentication + face/biometric verification

**For the attorney.** A step-up authentication gate for sensitive actions (payout, purchase, KYC, account
change) is BUILT and shipped **OFF by default** (`STEP_UP_ENABLED=0`). It works on any smartphone via layered
methods; one optional method (face/selfie) introduces **biometric-data** obligations that need your review
before it is enabled.

## What's built

Before a sensitive action, the server requires a **fresh, strong re-authentication** and re-validates the action
server-side ("device proposes, server disposes" — the sensitive core stays server-side even though the app runs
on the user's device). Methods, universal-coverage first:
- **passkey** (WebAuthn) — the device's own fingerprint/Face ID/PIN, verified cryptographically. **No biometric
  data leaves the device or reaches us** — lowest liability. Primary where available.
- **password** and **otp** (email/SMS one-time code) — universal fallback; every phone can do these.
- **face_vendor** — selfie + **liveness** performed by a specialized identity vendor (Persona/Onfido/iProov/
  FaceTec). Used only for the highest-risk actions. We store only the vendor's pass/fail + a reference — **never
  the raw biometric**. Code: `sdk/step-up-auth.ts`, `stepUpChallenge` / `stepUpVerify`, table `StepUpVerification`.

## Why "just a picture of a face" is not used as-is

A static selfie is trivially spoofable (hold up a photo), so any face method must include **liveness**; and face
templates are **biometric identifiers** carrying serious regulation. We therefore (a) never accept a bare photo,
(b) never build face-matching ourselves, and (c) route any face method through a vendor that does liveness +
handles the biometric data.

## Questions for counsel (before enabling `face_vendor`)

- **BIPA (Illinois) + Texas CUBI + Washington + others:** these require **written informed consent** before
  collecting biometric identifiers, a published **retention + destruction** schedule, and bar profiting from
  biometrics — with **statutory damages** (BIPA: $1,000–$5,000 per violation) and class actions. Confirm our
  consent flow, retention policy, and vendor contract (who is the controller/processor) satisfy them, and whether
  we should simply **exclude Illinois/Texas** from the face method.
- **GDPR / UK GDPR:** biometric data used to uniquely identify a person is **special-category** (Art. 9) —
  confirm lawful basis (explicit consent) and DPIA.
- **CCPA/CPRA + state privacy laws:** biometric info is sensitive personal information — disclosure + opt-out.
- **Vendor as processor:** confirm the DPA with the identity vendor, that the vendor (not us) holds the raw
  biometric, and data-residency.
- **Do we even need face at all?** Passkeys + password + OTP cover authentication universally with **no**
  biometric-data exposure. Advise whether the face method is worth the added liability, or whether it should be
  limited to KYC/first-payout only (where an identity vendor is used anyway).

## Owner action

Passkey + password + OTP can be enabled without the biometric questions above. Enable `face_vendor` **only**
after counsel clears the biometric-consent/retention flow and the vendor DPA; keep it scoped to the highest-risk
actions and excluded jurisdictions per counsel. Everything is OFF until then.
