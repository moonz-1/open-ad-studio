# Browser project storage (IndexedDB)

Open Ad Studio stores campaigns in IndexedDB database **`osh-adstudio-projects`** on the **browser origin** that serves the app (scheme + host + port).

## Important

- Changing port changes origin. Example: projects saved on `http://127.0.0.1:8304` are **not** visible on `http://127.0.0.1:8310`.
- This standalone app defaults to **port 8310** (see `.env.example`). Prior worktree previews used 8301 / 8302 / 8303 / 8304.
- The app **never clears** IndexedDB on startup. Opening a new origin simply starts with an empty local database.

## Safe promotion options

1. **Same-origin promotion (preferred)**  
   Point this repo’s `OSH_PORT` at the origin that already holds your projects (for example `8304`), then run `npm start`. No data copy required.

2. **Manual export / re-import**  
   From the old origin, use Journey **Your work** / Classic exports (PNG, MP4, request JSON) and re-upload product photographs into a new project on the new origin. There is no automatic cross-origin IndexedDB migration tool in this release.

3. **Browser profile tooling (advanced)**  
   Only with owner authorization: use Chrome’s DevTools Application → IndexedDB export, or a dedicated profile backup. Do not share profiles that contain private brand assets.

## Never do

- Do not copy another user’s Chrome profile.
- Do not delete IndexedDB to “fix” a port change.
- Do not commit `outputs/` media or `.env` secrets.
