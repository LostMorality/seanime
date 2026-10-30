<#
Builds this fork of Seanime on Windows.

  Desktop app installer (default):   .\build-fork.ps1
  Server only, used in a browser:    .\build-fork.ps1 -ServerOnly

Needs Git, Go and Node.js. If Go or Node.js is missing, it offers to install it with winget.
If PowerShell refuses to run the script, use:
  powershell -ExecutionPolicy Bypass -File .\build-fork.ps1
#>
param(
    [switch]$ServerOnly
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
Set-Location $root

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Fail($text) { Write-Host "`nBuild failed: $text" -ForegroundColor Red; exit 1 }

# Runs a command and stops the build if it fails
function Run {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { Fail "'$File $($Arguments -join ' ')' exited with code $LASTEXITCODE" }
}

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

function Require-Tool {
    param([string]$Command, [string]$Name, [string]$WingetId, [string]$Url)
    if (Get-Command $Command -ErrorAction SilentlyContinue) { return }
    Write-Host "$Name is not installed." -ForegroundColor Yellow
    if ($WingetId -and (Get-Command winget -ErrorAction SilentlyContinue)) {
        $answer = Read-Host "Install $Name now with winget? (Y/n)"
        if ($answer -eq "" -or $answer -match "^[Yy]") {
            Run winget @("install", "--id", $WingetId, "-e", "--accept-source-agreements", "--accept-package-agreements")
            Refresh-Path
            if (Get-Command $Command -ErrorAction SilentlyContinue) { return }
            Fail "$Name was installed but isn't found yet. Close this window, open a new one and run the script again."
        }
    }
    Fail "$Name is required. Get it from $Url and run the script again."
}

Step "Checking tools"
Require-Tool git "Git" "Git.Git" "https://git-scm.com/downloads"
Require-Tool go "Go" "GoLang.Go" "https://go.dev/dl/"
Require-Tool node "Node.js" "OpenJS.NodeJS.LTS" "https://nodejs.org/"

# Any Go from 1.21 on fetches the exact version go.mod asks for by itself
$goVersion = (& go env GOVERSION)
$nodeMajor = [int]((& node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) { Fail "Node.js 20 or newer is needed (found $(& node --version)). Get it from https://nodejs.org/" }
Write-Host "Go $goVersion, Node.js $(& node --version)"

Step "Building the web interface"
Push-Location seanime-web
Run npm @("ci", "--no-audit", "--no-fund")
Run npm @("run", "build")
if (-not $ServerOnly) { Run npm @("run", "build:denshi") }
Pop-Location

# The web build rewrites a couple of tracked files; put them back so the checkout stays clean
if (Test-Path .git) {
    & git checkout -- seanime-web/public/jassub/jassub-worker.js seanime-web/src/routeTree.gen.ts 2>$null
}

# The server embeds the web interface from ./web
if (Test-Path web) { Remove-Item web -Recurse -Force }
Copy-Item seanime-web/out web -Recurse

if ($ServerOnly) {
    Step "Building the server"
    $env:CGO_ENABLED = "0"
    Run go @("build", "-o", "seanime.exe", "-trimpath", "-ldflags=-s -w", "-tags=nosystray", ".")
    Write-Host "`nDone: $root\seanime.exe" -ForegroundColor Green
    Write-Host "Run it, then open http://127.0.0.1:43211 in your browser."
    exit 0
}

Step "Building the server for the desktop app"
New-Item -ItemType Directory -Force seanime-denshi/binaries | Out-Null
$env:CGO_ENABLED = "0"
Run go @("build", "-o", "seanime-denshi/binaries/seanime-server-windows.exe", "-trimpath", "-ldflags=-s -w", "-tags=nosystray", ".")

Step "Building the desktop app installer"
if (Test-Path seanime-denshi/web-denshi) { Remove-Item seanime-denshi/web-denshi -Recurse -Force }
Copy-Item seanime-web/out-denshi seanime-denshi/web-denshi -Recurse
Push-Location seanime-denshi
if (Test-Path dist) { Remove-Item dist -Recurse -Force }
Run npm @("ci", "--no-audit", "--no-fund")
Run npm @("run", "build:main")
Run npm @("run", "sync:mpv-prism", "--", "win32-x64")
# seanimeForkBuild turns off the auto-updater, which would otherwise replace this build with an official release
Run npx @("electron-builder", "build", "--win", "--x64", "--publish", "never", "--config.extraMetadata.seanimeForkBuild=true")
Pop-Location

$installer = Get-ChildItem seanime-denshi/dist -Filter "seanime-denshi-*_Windows_x64.exe" | Select-Object -First 1
if (-not $installer) { Fail "the installer wasn't found in seanime-denshi\dist" }
Write-Host "`nDone: $($installer.FullName)" -ForegroundColor Green
Write-Host "Run it to install. If the official Seanime Denshi is installed, this replaces it (your settings and library stay)."
