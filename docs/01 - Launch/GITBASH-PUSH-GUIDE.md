# Pushing your code to GitHub with Git Bash — step by step

This gets your full self-hosted (Base44-removed) source onto GitHub `main`, using **Git Bash**
on Windows. Total time: ~10 minutes. You need two files I delivered in the chat, both in the
**same folder** (e.g. your Downloads):
- `playearningnexus-NO-BASE44-20260720.zip`
- `push-full-source-to-github.sh`

---

## Step 1 — Install Git (includes Git Bash)
If you don't already have it:
1. Go to **https://git-scm.com/download/win** — the download starts automatically.
2. Run the installer. Accept all the defaults (just keep clicking **Next**, then **Install**).
3. This installs **Git Bash**.

## Step 2 — Get a GitHub access token (needed to push)
GitHub no longer accepts your account password over the command line — you use a **Personal
Access Token (PAT)** as the password instead.
1. Sign in to GitHub, then open **https://github.com/settings/tokens**
2. Click **Generate new token → Generate new token (classic)**.
3. Name it `gamergain-push`, set **Expiration** to 90 days, and check the **`repo`** box.
4. Click **Generate token** and **copy the token** (starts with `ghp_…`). You won't see it again —
   paste it somewhere safe for the next step.

## Step 3 — Open Git Bash in the right folder
1. Open the folder that has the zip + the script (e.g. **Downloads**) in File Explorer.
2. **Right-click** an empty area in that folder → **Open Git Bash here**.
   (A black terminal window opens, already in that folder.)

## Step 4 — Run the push (the exact code)
Type this and press Enter:
```bash
bash push-full-source-to-github.sh
```
When it reaches the push step it will ask for credentials:
- **Username:** `benjaminjohnvick-cmyk`
- **Password:** paste your **token** from Step 2 (right-click → Paste; the token stays hidden as
  you paste — that's normal). Press Enter.

That's it. The script fresh-clones your repo, replaces its contents with the full source, commits,
and pushes. When it finishes it prints a verification link.

---

## If you'd rather run it line by line (no script)
Paste these one at a time in Git Bash (from the folder with the zip):
```bash
# 1. unzip the source
unzip playearningnexus-NO-BASE44-20260720.zip -d gamergain-src

# 2. clone your repo
git clone https://github.com/benjaminjohnvick-cmyk/playearningnexus.git
cd playearningnexus

# 3. make sure you're on main
git checkout main

# 4. replace the repo's contents with the new source (keeps git history)
find . -mindepth 1 -maxdepth 1 -not -name '.git' -exec rm -rf {} +
cp -a ../gamergain-src/. .

# 5. stage, commit, and push
git add -A
git commit -m "Replace with self-hosted build (Base44 removed): SDK, backend, auth, GamerGain icons"
git push origin main
```
(At step 5's push, enter the username + token as above.)

## Step 5 — Verify it worked
Open this link in a browser:
**https://github.com/benjaminjohnvick-cmyk/playearningnexus/blob/main/DE-BASE44-REWORK.md**
If that page loads, your push succeeded. You can also just visit the repo and see the new files
(`backend/`, the updated `src/`, the GamerGain icons).

---

## Troubleshooting
- **`bash: push-full-source-to-github.sh: No such file or directory`** → You're not in the folder
  that has the script. In Git Bash type `ls` to list files; if you don't see the script and zip,
  navigate there, e.g. `cd ~/Downloads`.
- **`Authentication failed`** → You typed your GitHub *password* instead of the *token*. Redo with
  the `ghp_…` token from Step 2 as the password. (If it never asks again because it cached a wrong
  one, run `git config --global --unset credential.helper` and try again.)
- **`git: command not found`** → Git isn't installed / you're not in Git Bash. Do Step 1, then open
  **Git Bash** (not PowerShell or CMD).
- **`unzip: command not found`** → Git Bash includes unzip; if it's missing, just right-click the
  zip in Windows → **Extract All**, then point step 4's `cp` at that extracted folder instead.
- **"Everything up-to-date" / "Nothing changed"** → GitHub already matches the source; you're done.
- **Wrong account** → If Git Bash pushes as a different GitHub user, run:
  `git config --global user.email "benjaminjohnvick@gmail.com"` and use the token for the
  `benjaminjohnvick-cmyk` account.

## One-time convenience (optional)
So you don't re-enter the token every push, run once:
```bash
git config --global credential.helper manager
```
Windows will then remember your GitHub login securely.
