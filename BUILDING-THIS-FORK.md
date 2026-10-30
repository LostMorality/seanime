# Building this fork

This builds the Seanime version from this fork (branch `discover-improvements`), with all of its changes.
You end up with the same desktop app (Seanime Denshi) as the official one, or a server you use in your browser.

## What you need

- **Git**: https://git-scm.com/downloads
- **Go**: https://go.dev/dl/ (any recent version; it fetches the exact one it needs by itself)
- **Node.js 20 or newer**: https://nodejs.org/

On Windows the script offers to install Go and Node.js for you if they're missing.

The first build takes a while (about 10 to 20 minutes) because it downloads everything it needs. Later builds are faster.

## Windows

Open PowerShell and run:

```powershell
git clone -b discover-improvements https://github.com/LostMorality/seanime.git
cd seanime
powershell -ExecutionPolicy Bypass -File .\build-fork.ps1
```

When it finishes it prints where the installer is, inside `seanime-denshi\dist`. Run it to install.
If the official Seanime Denshi is already installed, this installs over it. Your settings, lists and library stay.

## macOS (Apple Silicon) and Linux

```bash
git clone -b discover-improvements https://github.com/LostMorality/seanime.git
cd seanime
./build-fork.sh
```

The app ends up in `seanime-denshi/dist` (a `.dmg` on macOS, an `.AppImage` on Linux).
Intel Macs can't build the desktop app; use the server-only build below.

## Server only (use Seanime in your browser)

Skips the desktop app and builds just the Seanime server:

- Windows: `powershell -ExecutionPolicy Bypass -File .\build-fork.ps1 -ServerOnly`
- macOS / Linux: `./build-fork.sh --server-only`

Run the `seanime` file it makes, then open http://127.0.0.1:43211 in your browser.

## Updates

The official app updates itself from the official releases. In a desktop app built with these scripts that is
**turned off**, because an official update would replace this version and remove the fork's changes.
To update, pull the latest changes and build again:

```bash
git pull
```

then run the build script again.

To go back to the official version, install it from https://seanime.app.

The server-only build can still offer official updates inside the app. If you accept one, it replaces this version.

## If something goes wrong

- **"running scripts is disabled on this system"** (Windows): use the `powershell -ExecutionPolicy Bypass -File ...` command shown above.
- **"Go was installed but isn't found yet"**: close the window, open a new one, and run the script again.
- **`npm ci` fails**: delete the `node_modules` folders inside `seanime-web` and `seanime-denshi`, then try again.
- **macOS says the app is damaged or can't be opened**: the app isn't signed. Right-click it, choose Open, and confirm.
