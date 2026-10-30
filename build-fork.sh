#!/usr/bin/env bash
# Builds this fork of Seanime on macOS or Linux.
#
#   Desktop app (default):          ./build-fork.sh
#   Server only, used in a browser: ./build-fork.sh --server-only
#
# Needs Git, Go and Node.js 20+. The desktop app builds for Apple Silicon Macs and x64/arm64 Linux.
set -euo pipefail
cd "$(dirname "$0")"
root="$(pwd)"

server_only=false
[[ "${1:-}" == "--server-only" ]] && server_only=true

step() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mBuild failed: %s\033[0m\n' "$1"; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "$2 is required. Get it from $3 and run the script again."; }

step "Checking tools"
need git "Git" "https://git-scm.com/downloads"
need go "Go" "https://go.dev/dl/"
need node "Node.js" "https://nodejs.org/"
node_major=$(node --version | sed 's/^v//' | cut -d. -f1)
[[ "$node_major" -ge 20 ]] || fail "Node.js 20 or newer is needed (found $(node --version)). Get it from https://nodejs.org/"
echo "$(go env GOVERSION), Node.js $(node --version)"

os=$(uname -s)
arch=$(uname -m)
case "$arch" in
    x86_64|amd64) goarch=amd64 ;;
    arm64|aarch64) goarch=arm64 ;;
    *) fail "unsupported CPU: $arch" ;;
esac

if ! $server_only; then
    case "$os" in
        Darwin)
            [[ "$goarch" == arm64 ]] || fail "the desktop app only builds for Apple Silicon Macs. Use --server-only on Intel Macs."
            server_name="seanime-server-darwin-arm64"; mpv_target="darwin-arm64"; builder_args=(--mac --arm64) ;;
        Linux)
            server_name="seanime-server-linux-$goarch"
            if [[ "$goarch" == amd64 ]]; then mpv_target="linux-x64"; builder_args=(--linux --x64)
            else mpv_target="linux-arm64"; builder_args=(--linux --arm64); fi ;;
        *) fail "unsupported system: $os (on Windows, use build-fork.ps1)" ;;
    esac
fi

step "Building the web interface"
(
    cd seanime-web
    npm ci --no-audit --no-fund
    npm run build
    $server_only || npm run build:denshi
)

# The web build rewrites a couple of tracked files; put them back so the checkout stays clean
[[ -d .git ]] && git checkout -- seanime-web/public/jassub/jassub-worker.js seanime-web/src/routeTree.gen.ts 2>/dev/null || true

# The server embeds the web interface from ./web
rm -rf web
cp -R seanime-web/out web

if $server_only; then
    step "Building the server"
    CGO_ENABLED=0 go build -o seanime -trimpath -ldflags="-s -w" .
    printf '\n\033[32mDone: %s/seanime\033[0m\n' "$root"
    echo "Run it, then open http://127.0.0.1:43211 in your browser."
    exit 0
fi

step "Building the server for the desktop app"
mkdir -p seanime-denshi/binaries
CGO_ENABLED=0 go build -o "seanime-denshi/binaries/$server_name" -trimpath -ldflags="-s -w" -tags=nosystray .

step "Building the desktop app"
rm -rf seanime-denshi/web-denshi
cp -R seanime-web/out-denshi seanime-denshi/web-denshi
(
    cd seanime-denshi
    rm -rf dist
    npm ci --no-audit --no-fund
    npm run build:main
    npm run sync:mpv-prism -- "$mpv_target"
    # seanimeForkBuild turns off the auto-updater, which would otherwise replace this build with an official release
    npx electron-builder build "${builder_args[@]}" --publish never --config.extraMetadata.seanimeForkBuild=true
)

printf '\n\033[32mDone: the app is in %s/seanime-denshi/dist\033[0m\n' "$root"
ls seanime-denshi/dist | grep -E '\.(dmg|zip|AppImage)$' || true
