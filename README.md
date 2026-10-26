# MUXI — Beat Marketplace UI (starter)

This is the first responsive React/Vite UI for MUXI. It uses demo beat metadata; audio playback, authentication, checkout, purchases and secure downloads are not connected yet.

## Requirements
- Windows 10 64-bit
- Node.js LTS (install from https://nodejs.org/)
- A modern browser
- For Android builds: Android Studio + Android SDK + JDK 17

## Run the website
1. Extract the ZIP to a simple folder, e.g. `C:\Projects\MUXI`.
2. Open that folder in VS Code.
3. In VS Code, open Terminal > New Terminal.
4. Run:
   ```powershell
   npm install
   npm run dev
   ```
5. Open the local URL printed by Vite (usually `http://localhost:5173`).

If PowerShell blocks npm scripts, open Command Prompt (cmd.exe) instead and run the commands there.

## Connect a new Supabase project (optional for this UI stage)
1. Create a project at https://supabase.com/.
2. In the project dashboard, find the Project URL and publishable/anon client key in API settings.
3. Copy `.env.example` to `.env.local`.
4. Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
5. Restart the Vite server after changing `.env.local`.

Never place a Supabase `service_role` key in frontend code. Before adding real beat uploads, orders or payment approvals, configure Row Level Security (RLS), private storage buckets and server-side checks.

## Android project
1. Install Android Studio and the Android SDK. Configure JDK 17 for Capacitor/Android.
2. In the project folder run:
   ```powershell
   npm run build
   npx cap add android
   npx cap sync android
   npx cap open android
   ```
3. Android Studio opens the project. Wait for Gradle sync, then use a connected Android phone with USB debugging or an emulator to run it.
4. After web changes, run `npm run android:sync` to rebuild the web assets and sync Android.

## Current UI interactions
- Search by beat name, producer, genre or key
- Filter by genre
- Sort by price or BPM
- Favorite toggle (temporary in-memory state)
- Preview player UI (visual demo only; no audio file is connected)
- Responsive sidebar and mobile layout

## Next development steps
1. Create Supabase tables for profiles, beats, licenses, orders and purchases.
2. Add authentication and producer/admin roles.
3. Add upload flow and private full-quality audio storage; keep preview files separate.
4. Add secure checkout and purchase verification before download.
5. Connect real audio previews and persist favorites.

## Notes
- Demo numbers and beats are placeholder content and must be replaced with real data.
- The Google Fonts import needs an internet connection; the UI falls back to system fonts if unavailable.


## Supabase backend foundation
See `SUPABASE_SETUP_MY.md` and `supabase/schema.sql`. The current `src/App.jsx` remains a demo UI; backend schema and helpers do not mean the full order/upload screens are already connected.
