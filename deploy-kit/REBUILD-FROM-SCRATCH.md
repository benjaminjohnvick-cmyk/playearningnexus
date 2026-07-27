# Rebuild the Whole Site From Scratch

This repo (and `GamerGain-SOURCE-CODE.zip`) is a complete, self-contained copy of the app. From it you
can reconstruct the **entire running site** with one command — no re-coding, no guesswork.

> Honest note: nothing can "auto-generate" an app's code from nothing — **the source in this repo is
> the site.** What the script below does is rebuild a *working, running copy* of the site from that
> source automatically (install deps → start the database + backend → build + serve the frontend).

## What you need first (install once)
- **Node.js 18+** — https://nodejs.org
- **Docker Desktop** — https://www.docker.com/products/docker-desktop (start it before running)

## Rebuild it (one command)

**Windows (PowerShell), from the repo root:**
```
powershell -ExecutionPolicy Bypass -File deploy-kit\rebuild-from-scratch.ps1
```

**Mac / Linux / Git Bash, from the repo root:**
```
bash deploy-kit/rebuild-from-scratch.sh
```

The script:
1. Checks Node + Docker are installed and Docker is running.
2. Installs the frontend dependencies and points the app at the local backend.
3. Creates `backend/.env` from the example (if missing).
4. Starts **Postgres + the backend** with Docker — the database schema loads itself and the backend
   auto-migrates and boots.
5. Builds the frontend and serves it.

When it finishes:
- **Frontend:** http://localhost:4173
- **Backend API:** http://localhost:8000 (health check at `/health`)

The site runs immediately. To turn on AI, payments, email, surveys, etc., paste your real keys into
`backend/.env` (see `API-KEYS-WORKSHEET.md`) and restart. Stop everything later with
`cd backend && docker compose down`.

---

## Restoring the repository from `GamerGain-SOURCE-CODE.zip`

If you ever need to put this exact code back into GitHub (e.g. recover the repo), the ZIP is a full
copy of the source tree (everything except `node_modules`, which `npm install` regenerates).

**Easiest (GitHub Desktop):**
1. Unzip `GamerGain-SOURCE-CODE.zip` to a folder.
2. GitHub Desktop → **File → Add local repository** → pick that folder.
3. If it isn't a repo yet, GitHub Desktop offers to create one — do that, then **Publish/Push**.

**Command line:**
```
cd <unzipped-folder>
git init
git add -A
git commit -m "Restore full source from ZIP"
git branch -M main
git remote add origin https://github.com/benjaminjohnvick-cmyk/playearningnexus.git
git push -u origin main          # add --force ONLY if you intend to overwrite what's on GitHub
```

> The code in `GamerGain-SOURCE-CODE.zip` already matches what's currently pushed to `main`, so you
> normally don't need to restore anything — this is here for disaster recovery.
