# Survey Loop Live Test — BitLabs → credit → AI loop

Verifies the core earning loop end-to-end. Target: **~4–6h** (down from 6–10h) by testing in this exact order.

## The chain you're verifying
`User completes a BitLabs survey → BitLabs postback hits your backend → user's store credit is
credited → a SurveySignal is written → the human-input harvester + agent triggers pick it up →
(if flagged) it lands in the oversight queue.`

## Setup
1. In the **BitLabs dashboard**, set the **postback/callback URL** to your backend's survey callback
   endpoint (see `backend/functions/` survey ingest/postback route) — format:
   `https://<backend-domain>/functions/<surveyCallback>?user_id={user_id}&amount={reward}&tx={tx_id}`
   (confirm the exact param names your function expects in the entry file).
2. Set `BITLABS_API_KEY` in the backend + scheduler variables.

## Test steps
| # | Action | Expected |
|---|---|---|
| 1 | Open the app as a test user → go to Surveys → complete a BitLabs test survey | BitLabs marks it complete |
| 2 | Watch backend logs for the postback | Callback received; signature/params validated |
| 3 | Check the user's balance | Store credit increased by the survey reward |
| 4 | Check `SurveySignal` (admin or DB) | A new signal row exists for this completion |
| 5 | Wait for (or manually invoke) `humanInputHarvester` | Signal harvested; `survey.signal.created` event emitted |
| 6 | Trigger a fraud edge case (e.g., rapid repeat) | `earningVelocityMonitor` flags it; lands in oversight queue |
| 7 | Approve/deny in the oversight queue | Decision recorded; credit released or withheld accordingly |

## Common gotchas (so you don't lose hours)
- **Postback param names** must match exactly what the callback function reads — check the entry file first.
- **Duplicate protection:** re-firing the same `tx_id` must NOT double-credit (verify idempotency).
- The **scheduler service** must be running for `humanInputHarvester` / triggers to fire on schedule
  (or invoke the function manually to test without waiting for cron).

## Sign-off
- [ ] Postback credits the correct user · [ ] Signal written · [ ] Harvester + trigger fire ·
- [ ] Fraud path reaches oversight · [ ] Duplicate tx does not double-credit
