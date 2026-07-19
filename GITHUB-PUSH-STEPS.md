# How to Put Tonight's Changes on GitHub (Codespace, step by step)

You'll do this once. It takes about 3 minutes. Nothing here can hurt your repo.

---

## Part A — Get the ZIP from this chat
1. In this Claude conversation, find the file **`playearningnexus-MERGED-FINAL.zip`**.
2. Click it to **download** it to your computer (it usually goes to your Downloads folder).

## Part B — Open your Codespace
3. Go to **github.com/benjaminjohnvick-cmyk/playearningnexus** in your browser.
4. Click the green **`< > Code`** button → **Codespaces** tab → open your existing Codespace (or click **Create codespace on main**). Wait for it to load — it looks like VS Code in the browser.

## Part C — Put the ZIP into the Codespace
5. On the **left side** of the Codespace is the file list (the Explorer). At the top you'll see the folder name **playearningnexus**.
6. **Drag** `playearningnexus-MERGED-FINAL.zip` from your computer's Downloads **into that left-side file list** and drop it. Wait a few seconds — the file name appears in the list when the upload finishes.

## Part D — Open the terminal
7. In the top menu of the Codespace, click **Terminal → New Terminal**. A command box opens at the bottom.

## Part E — Paste these commands
8. Click into the terminal, paste the block below, and press **Enter**:

```
cd /workspaces/playearningnexus
unzip -o playearningnexus-MERGED-FINAL.zip -d .
git add -A
git commit -m "Full session update: features, compliance, prize-pool rename, shared wallets, docs"
git push origin main
```

9. If it says `unzip: command not found`, paste this first, press Enter, then repeat step 8:
```
sudo apt-get update && sudo apt-get install -y unzip
```

10. When it finishes you'll see something like `... main -> main`. That means it's on GitHub. ✅

## Part F — Confirm it worked
11. Go back to **github.com/benjaminjohnvick-cmyk/playearningnexus** and refresh.
12. You should now see **CHANGES.md** and **SETUP-RUNBOOK.md** in the file list, and the commit count will have gone up by one. That's everything from tonight, now on GitHub.

---

### If something looks off
- **Wrong folder?** Type `ls` and press Enter. If you don't see `package.json`, you're in the wrong place — type `cd /workspaces/playearningnexus` again, or `cd` into whatever folder `ls` shows.
- **"nothing to commit"?** The unzip didn't land in the repo folder. Make sure the ZIP was dropped into the **playearningnexus** folder in step 6, then repeat step 8.
- **Asked to sign in / permission denied on push?** Your Codespace needs GitHub write access — click the **account icon** (bottom-left of the Codespace) and make sure you're signed in as benjaminjohnvick-cmyk.
