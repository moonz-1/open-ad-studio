# Download, launch, create

## First launch

1. Install **Node.js 22.18 or newer**, including npm, from https://nodejs.org. Reopen the launcher after installing it. The app does not install Node or GPU drivers for you.
2. Download the repository ZIP and **extract all files**, or clone the repository. Do not run the launcher inside the ZIP preview.
3. Windows: double-click `start.cmd`. macOS: right-click `start.command` and choose Open. Linux/macOS terminal alternative: `sh start.command` from the extracted folder.
4. Wait for application packages and the first production build. Your browser opens Journey. Keep the launcher window open. Close it or press Ctrl+C to stop that app.

The launcher does not download weights, install ComfyUI, buy services or submit inference. You can use Basic planning and Product-safe composition immediately with an authorized photograph. A first install needs internet for the npm packages; allow several minutes on a slow connection. Dependencies are reused until the lockfile, package manifest, platform or Node major changes.

ZIP downloads do not need Git. Their build manifest records an archive source fingerprint and the exported commit when available. A Git checkout additionally requires Git and a clean committed source tree for production startup. Edit with `npm run dev`; production startup deliberately rejects uncommitted Git changes.

## Address and saved work

The default is `http://127.0.0.1:8341/adstudio/journey.html`. If occupied, the launcher chooses another free loopback port and prints/opens it. It never kills an existing process. It remembers the selected port for this folder. Launching the same unchanged installation again opens its existing server.

Projects and original-image Blobs are stored in this browser's IndexedDB. **Keep the same browser profile and address.** A different port, hostname, browser or cleared site data has separate storage. If an older version from this folder is running, close that launcher window before updating. Do not run an updated second copy and assume its browser storage is shared.

## Connect AI later

Follow [Connect AI](CONNECT_AI.md). No key or subscription is needed for Product-safe design. Local inference and Cloud are optional, separately configured paths. Credentials belong in this application's root `.env` only. Never put them into a browser prompt, screenshot, public file or variable beginning with `VITE_`.

## Common problems

| Message or symptom | What to do |
| --- | --- |
| Node missing / too old | Install Node 22.18+ with npm; reopen the launcher. On Windows, `node --version` in a new command prompt should show the new version. |
| npm missing | Reinstall Node with the npm component included. The launcher runs npm using the same Node binary. |
| Download/install fails | Check internet/proxy settings and folder write permission, then relaunch. Do not delete saved browser data. |
| macOS blocks the downloaded launcher | Use right-click → Open, or `sh start.command` from Terminal after reviewing the repository. Native macOS Gatekeeper behavior was not tested on this Windows machine. |
| No browser opens | Open the exact URL printed in the launcher. Linux needs a working desktop URL opener for automatic opening. |
| Port occupied | The launcher chooses a free port; projects remain tied to the original address. Close your own old launcher if you need its port. |
| ComfyUI unavailable | Product-safe still works. For AI, start your separate ComfyUI installation and follow the connection guide. |
| FFmpeg unavailable | PNG export still works. Install FFmpeg/FFprobe separately or configure their paths to use MP4 assembly. |

## Manual and developer commands

```sh
npm ci
npm start
# For development instead:
npm run dev
```

`npm start` is the strict production server, with an already installed dependency set and a fixed configured port. The convenience launcher adds dependency setup, safe port selection and browser opening around it.

Checks: `npm run typecheck`, `npm run build`, `npm run test:release`, and `node --test adstudio/scripts/launch.test.mjs`.

The README describes launcher changes prepared on the submission-staging branch. They reach the public ZIP only after the owner authorizes the final release push. Windows is tested directly; macOS/Linux launcher syntax and command construction are tested, with native desktop behavior remaining unverified.
