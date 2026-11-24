# ระบบจองห้องประชุม · กองทรัพยากรบุคคล

Next.js app for booking **ห้องประชุมกาลพฤกษ์ 10** and **ห้อง SMART Meeting**. Bookings are stored directly in Google Sheets; sign-in uses Google OAuth directly (no Supabase) and is restricted to `@kku.ac.th`.

## What the app does

- Day view with 10 one-hour slots (08:00–17:00) for each room
- Click any free slot to create a booking (pick an end time, purpose, note)
- Real conflict detection – the same room/time cannot be booked twice
- View booking details, **edit** or cancel your own booking (admins can edit/cancel any)
- "รายการของฉัน" tab for your upcoming bookings
- Google Sheets gets an auto-generated, human-readable summary tab for each month that has bookings (prefixed `สรุป `), refreshed whenever a booking is created, edited or cancelled
- Thai (พ.ศ.) dates throughout

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

With an empty `.env.local` the app runs in **dev mode**:

- No login required (a stand-in `dev@kku.ac.th` user is used)
- Bookings are written to `.data/bookings.json` (git-ignored)

Open <http://localhost:3000> — it redirects to `/book`.

## Connect Google Sheets

1. In Google Cloud Console, create a **Service Account** and download its JSON key.
2. Enable the **Google Sheets API** for the project.
3. Open the [booking spreadsheet](https://docs.google.com/spreadsheets/d/1IByz6Lg7pqOb1e_WOdW_tE05_GPgEJiPdMgKNDqHhsQ/edit) and share it with the service account email as **Editor**.
4. Fill in `.env.local`:

```env
GOOGLE_SHEETS_ID=1IByz6Lg7pqOb1e_WOdW_tE05_GPgEJiPdMgKNDqHhsQ
GOOGLE_SERVICE_ACCOUNT_EMAIL=booking-bot@YOUR_PROJECT.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEETS_TAB=Bookings
```

The app creates the `Bookings` tab and its header row automatically on first use. It never edits the existing monthly calendar tabs.

### Sheet columns

| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| id | roomId | date | startHour | endHour | title | requesterName | requesterEmail | note | createdAt |

`date` is ISO (`YYYY-MM-DD`), hours are 24h integers, `endHour` is exclusive. Keeping this flat tab as the source of truth makes conflict checks reliable; the old monthly tabs can remain as human-readable views.

## Enable Google login

No Supabase is needed. The app talks to Google directly via Auth.js.

1. In Google Cloud Console → **APIs & Services → Credentials** → **Create credentials → OAuth client ID** → **Web application**.
2. Add these **Authorized redirect URIs** (exact, no trailing slash):
   ```
   http://localhost:3000/api/auth/callback/google
   https://YOUR-DOMAIN/api/auth/callback/google
   ```
3. Copy the **Client ID** and **Client secret** into `.env.local`, together with a random `AUTH_SECRET`:
   ```env
   GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
   AUTH_SECRET=.RandomBase64String.
   NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=kku.ac.th
   ADMIN_EMAILS=pongka@kku.ac.th
   ```
   Generate a secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

Users with other email domains are rejected by the server even if Google shows them in the account picker. `ADMIN_EMAILS` lists who may edit/cancel any booking.

## Deploy

Deploy to Vercel and add the same environment variables. Use a Vercel environment variable for `GOOGLE_PRIVATE_KEY` with literal `\n` characters as shown above.

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve production build
npm run typecheck  # TypeScript check
npm run import:legacy -- --dry-run  # preview the one-off legacy import
npm run import:legacy               # merge the 44 legacy rows into the datastore
npm run report:monthly -- --dry-run # preview the monthly summary tabs
npm run report:monthly              # create/refresh all summary tabs once (also done automatically by the app)
```

## Source data

The original spreadsheet has 14 monthly tabs (พฤศจิกายน 69 – ธันวาคม 2570). Each month contains two stacked blocks:

- `ห้องประชุมกาลพฤกษ์ 10` — date, purpose, hourly columns 8:00–17:00, requester
- `ห้อง SMART Meeting` — same layout

The time of a legacy booking is encoded by the **background colour of the hour cells**, not by text. `scripts/legacy-bookings.json` contains the **44 rows that have a shaded range**; rows without any shading were deliberately skipped and can be added later when a time is specified. Thai Buddhist-era years were converted to ISO (2570 → 2027).

Run `npm run import:legacy` once after configuring the datastore. It appends the rows to the `Bookings` tab (or `.data/bookings.json` in dev mode) with ids like `legacy_001_2026-11-02`, so re-running it will not duplicate anything. Legacy rows use `legacy@imported.local` as the requester email; they appear as "การจองของผู้อื่น" in the board, and an admin can cancel them if `ADMIN_EMAILS` is set.

The 14 monthly tabs are kept as a read-only archive. Future months do **not** need new tabs: month is just part of the `date` column in the single `Bookings` tab. For HR who prefer a familiar calendar, the app automatically creates/ refreshes tabs named `สรุป พฤศจิกายน 69` etc. from the `Bookings` data; these are display-only copies and the original tabs are never edited. There is one genuine overlap in the legacy data (3 November 2026), so the day view lays overlapping bookings out side by side.
