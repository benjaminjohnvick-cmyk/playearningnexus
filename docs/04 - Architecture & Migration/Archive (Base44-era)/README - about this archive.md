# Archive — Base44-era documents (historical)

These files are kept for reference only. **They describe the app as it was written on Base44, before the self-hosted migration.** The code snippets here still show the old `npm:@base44/sdk` imports and `base44/functions/…` paths. They do **not** reflect how the app runs today.

Read these only if you want to see the original Base44 implementation of a feature. For how the app works now, use the main guides in `01 - Launch` and `04 - Architecture & Migration` (outside this folder).

What's in here:

- **CODE-CHANGES-FULL.md** — the full running changelog of code changes made during the original Base44 build (features, fixes, entity/function additions). Base44-era paths and SDK.
- **CODE-JACKPOT-CONVERSION.md** — the source for the gambling→skill/merit conversion of the referral contest (the "jackpot" → performance-ranked tournament). Base44-era paths and SDK. The *behavior* described (open, merit-based, no random draw) is still current; only the code paths changed in the migration.
- **GITHUB-PUSH-STEPS (superseded).md** — the original Codespace/ZIP push instructions. **Superseded** by `01 - Launch/GITBASH-PUSH-GUIDE.md`, which is the current way to push from your PC.
- **ORIGINAL-BASE44-FULL-CODE.txt** — the **complete original Base44 source**, every file inline (~1,691 files, ~253,700 lines), exactly as it was before the migration (imports still show `@base44/sdk`). Kept as a preservation backup and as the audit source for the 100% gap check.
