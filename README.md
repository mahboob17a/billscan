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

## Status: Phase 0 — Setup

- [x] Expo project, Expo Router, TypeScript, path alias `@/`
- [x] Theme tokens (Slate `#1B2230`, Royal Violet `#6D4AFF`, Mint `#10B981`, Lavender Mist `#F4F2FB`), IBM Plex fonts
- [x] App icon, Android adaptive icon, splash screen assets (`scripts/make_brand_assets.py`)
- [x] Excel report template bundled (`assets/templates/DTR-PUR-UTAS-NIZWA-template.xlsx`)
- [x] Money helpers in baisa with unit tests (`src/lib/money.ts`)
- [x] Supabase schema: multi-user profiles (admin / supervisor) with row-level security, AI call log
- [x] Edge Function `extract-bill`: ping health check + extraction with strict schema (prompt v0.1)
- [x] EAS build profiles (development, preview APK, production)
- [x] Phase 0 system-check screen (theme, fonts, template, maths, server link)
- [ ] Your accounts and keys connected — see [`docs/SETUP-CHECKLIST.md`](docs/SETUP-CHECKLIST.md)
- [ ] First APK installed on your phone

## Project layout

```
src/
  app/            Screens (Expo Router). index.tsx = Phase 0 system check
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
