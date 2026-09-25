# BillScan

Scan purchase bills with your phone, let AI read the totals, and produce the monthly
**DTR-PUR-UTAS-NIZWA** purchase report in the exact Excel format head office receives.

Daryas Trading & Contracting LLC · UTAS Nizwa O&M contract.

| | |
|---|---|
| App | Expo SDK 57 · React Native 0.86 · TypeScript · Expo Router |
| Backend | Supabase (login, user profiles, AI call log) + Edge Function `extract-bill` |
| AI | OpenAI vision model with a strict JSON schema; key stored only on the server |
| Data on phone | SQLite (bills, cash entries), amounts in whole baisa |
| Target | Android first (APK test builds), iPhone later from the same code |

Design and plan: see the **BillScan Blueprint** (v0.8) and **BillScan Roadmap** in the Claude project.

## Status

**Phase 0 — Setup: done.** Supabase project, `extract-bill` function with the OpenAI key, admin account, APK built by GitHub Actions.

**Phase 1 — Foundation: built (v0.2.0).**
- [x] Splash held until fonts, database and saved sign-in are ready
- [x] Login with email or employee ID + password (Supabase Auth); session kept in the phone's secure store
- [x] Fingerprint / Face ID unlock (with phone PIN fallback) at start-up and after 5 minutes in the background
- [x] Tabs: Month dashboard · Scan (Phase 2) · Cash received · Report (Phase 3) · Settings
- [x] On-phone SQLite database: report months, bills, cash entries, description list, settings — all per user
- [x] Cash received (Section F) add / delete, feeding the balance due
- [x] Settings: name and designation, quick unlock, report header, system check, sign out

**Phase 2 — Scan and review: built (v0.3.0).**
- [x] Scan with the camera (ML Kit document scanner, up to 3 pages), pick from the gallery, or enter by hand
- [x] Photos kept with each bill (resized ~1600 px); the AI reads them through `extract-bill` (prompt v0.3)
- [x] Review screen: photo zoom, checks (sum, 5% VAT, missing fields, other month), description chips, discount type, VAT-from-total
- [x] Save / keep as draft / mark cancelled (Section B) / delete, with a duplicate warning
- [x] Section lists (A, B, C, D, E) and drafts list from the dashboard
- [x] Accuracy test on 16 real bills (GitHub Actions → "AI accuracy test")

**Phase 3 — Monthly report: built (v0.4.0).**
- [x] Report tab: section totals, cash received, balance due, drafts warning, Date Prepared
- [x] Excel export fills the bundled DTR template (navy/sand styling, column widths, page setup kept)
- [x] One row per bill in Sections A–E (dates as real Excel dates, amounts 0.000), "No … recorded" line for empty sections
- [x] Sub-total formula under each section; Section G uses live formulas: Total Purchase (A+C+D+E, cancelled excluded), Cash Received, Balance Due = Purchase − Cash
- [x] File name from the statement reference (DTR-PUR-UTAS-NIZWA-YYYY-MM.xlsx); a change after export makes the next file -R1, -R2…
- [x] Share sheet: email, WhatsApp, Drive

Install the latest test build on Android: https://github.com/mahboob17a/billscan/releases/latest/download/billscan.apk

## Project layout

```
src/
  app/            Screens (Expo Router): login, lock, (tabs)/…, report-settings, system-check
  auth/           AuthProvider: session, profile, app lock
  db/             SQLite schema, migrations and queries
  state/          Selected report month
  components/     Shared UI (Logo)
  lib/            config, backend ping, money maths (+ __tests__)
  theme/          Colour, spacing, type tokens; fonts
assets/           Icons, splash, templates/DTR-PUR-UTAS-NIZWA-template.xlsx
supabase/
  migrations/     Database schema (profiles, ai_calls, RLS)
  functions/extract-bill/   Edge Function holding the OpenAI key
docs/             Setup checklist
scripts/          Brand asset generator
```

## Commands

```bash
npm install
cp .env.example .env          # then fill in the Supabase URL and anon key
npx expo start                # run on your phone (development build or Expo Go)
npm test                      # unit tests
npm run typecheck             # TypeScript
npm run build:android:preview # APK via EAS Build
```

Add Expo packages with `npx expo install <package>` so versions match SDK 57.

## Security notes

- The OpenAI key is a **server secret** (`supabase secrets set OPENAI_API_KEY=...`). It is never in the app, the repo or `.env`.
- `EXPO_PUBLIC_*` values are public by design (Supabase URL and anon/publishable key); data is protected by row-level security.
- Supervisors can only read their own profile and change their own name/designation. Role, active flag and employee ID are admin-only.
- Every AI call is logged per user in `ai_calls` for cost control.
