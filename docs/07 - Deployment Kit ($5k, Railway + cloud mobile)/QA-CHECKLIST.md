# Go-Live QA Checklist — scripted, feature by feature

A concrete pass so QA doesn't sprawl (target ~7–9h vs 10–15h). Do it on the **live** frontend against
the **live** backend, as a fresh test user, then as an admin. Check each box or file a bug.

## Auth
- [ ] Sign up with email → account created, logged in
- [ ] Log out → log back in
- [ ] Password reset → email arrives (SendGrid) → new password works
- [ ] "Continue with Google" (if `GOOGLE_CLIENT_ID` set) → creates/links account
- [ ] Session persists on refresh; expired/invalid token redirects to login

## Earning loop
- [ ] Surveys list loads; completing one credits store credit (see `SURVEY-LOOP-TEST.md`)
- [ ] Games load and play; rewards credit correctly
- [ ] Referral link works → referred signup attributes to referrer
- [ ] Daily goal / streak updates

## Store & economy
- [ ] Product search returns items
- [ ] Buy store credit by card (Stripe) and by PayPal both work
- [ ] Order an item with credit → 10% markup applied once → Order created
- [ ] `pending_ai_fulfillment` order is picked up by the fulfillment pipeline (or queued)
- [ ] Add-Credit button reachable from wallet/profile nav
- [ ] Balance cannot be edited from the browser (server-authoritative)

## Payouts (partners)
- [ ] Partner payout request enters the oversight/approval queue
- [ ] Admin approves → payout executes; regular users cannot request cash

## Admin & agents
- [ ] Admin dashboards load **and show data** (verify the fixed `role === 'admin'` guards work)
- [ ] Oversight queue shows pending money/fraud items; approve/deny works
- [ ] Agent Learning dashboard loads
- [ ] Scheduler is running (cron jobs registered in logs)

## Legal & PWA
- [ ] Privacy Policy and Terms live at public URLs
- [ ] PWA installs ("Add to Home Screen"): icon, splash, full-screen
- [ ] Deep links resolve (SPA fallback working — no 404 on refresh of /Wallet etc.)
- [ ] HTTPS on both frontend and backend domains

## Cross-device
- [ ] Works on a real Android phone (Chrome) and iPhone (Safari)
- [ ] Push notification permission prompt appears (if VAPID configured)

## Final
- [ ] No console errors on the main flows · [ ] `/health` green · [ ] A test order + payout done in production
