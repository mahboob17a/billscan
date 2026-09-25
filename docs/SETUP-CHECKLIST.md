# Phase 0 setup checklist

Everything here needs your own accounts, so it is done by you (about 1–2 hours in total).
Tick each step; send me any error message and I will sort it out.

## 1. GitHub repository (code home)

1. On github.com create a **private** repository named `billscan` (no README, no .gitignore).
2. Either:
   - **Push it yourself** from the zip I sent:
     ```bash
     cd billscan
     git remote add origin https://github.com/<your-user>/billscan.git
     git push -u origin main
     ```
   - **Or let me push**: connect GitHub to this Claude session, or give me the repository URL and a
     fine-grained personal access token limited to that one repository (Contents: read & write).

## 2. OpenAI API key

1. platform.openai.com → **API keys** → *Create new secret key* (name it `billscan-server`).
2. Add a payment method and set a **monthly usage limit** (Billing → Limits) so costs can never run away.
3. Keep the key private. It goes only into Supabase in step 3 — never into the app or GitHub.

## 3. Supabase project (login + server)

1. supabase.com → *New project* → name `billscan`, region closest to Oman, strong database password.
2. Install the Supabase CLI (https://supabase.com/docs/guides/cli), then in the project folder:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push                                   # creates profiles + ai_calls tables
   supabase secrets set OPENAI_API_KEY=sk-...         # the key from step 2
   supabase functions deploy extract-bill --no-verify-jwt
   ```
3. **Create your admin account**: Dashboard → Authentication → Users → *Add user* (your email + password).
   Then SQL Editor → run:
   ```sql
   update public.profiles
   set role = 'admin', full_name = 'Mahboob Alam Ansari', designation = 'Maintenance Supervisor'
   where id = (select id from auth.users where email = 'YOUR-EMAIL');
   ```
4. Authentication → Sign In / Providers → **turn off “Allow new users to sign up”**. Only you (admin) create accounts.
5. Project Settings → API: copy the **Project URL** and the **anon / publishable key** into `.env`
   (see `.env.example`).

## 4. Expo account and Android test build

1. Create a free account at expo.dev.
2. In the project folder:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init                            # links the project, adds its ID to app.json
   npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
   npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <key> --visibility plaintext
   npm run build:android:preview
   ```
3. When the build finishes, open the link on your Android phone and install the APK
   (allow “install unknown apps” for your browser when asked).

## 5. Google Play developer account (can wait until Phase 5)

Needed only to publish v1.0 through the Play Store internal track. Test APKs install without it.

## 6. Sample bills (needed before Phase 2 starts on 18 Oct)

Photograph 20 or more real bills, flat and in good light, and share them with me. Include:

- Hardware / MEP, electrical, plumbing, paint, tiles, carpentry purchases
- Sewage tanker receipts, fuel slips, a tools purchase
- At least one handwritten cash memo and one receipt that shows only the total
- One bill with a discount **before VAT** and one with a round-off **after VAT**
- At least one Arabic-only bill

Also send the October report you prepare by hand — it is the reference for the Phase 3 comparison.

## Phase 0 is done when

- [ ] The BillScan APK is installed on your phone and shows the system-check screen
- [ ] All four checks are green, including **Server and AI key** after tapping *Test server connection*
