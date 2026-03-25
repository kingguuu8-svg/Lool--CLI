# Release Checklist

## Repo hygiene

- [ ] `config/vps.json` is not present
- [ ] `.secrets/` is not present
- [ ] no private keys are present
- [ ] no runtime logs are present
- [ ] no local IPs or personal paths remain in docs

## Build outputs

- [ ] `build-apk.bat` completes
- [ ] `dist/android/app-debug.apk` exists
- [ ] release build exists when signing is configured
- [ ] `build-launcher.bat` completes
- [ ] `dist/launcher/LoolCLI-Launcher-win-x64.exe` exists
- [ ] `scripts/write-checksums.ps1` generates `dist/checksums.txt`

## Docs and assets

- [ ] README hero and preview images render on GitHub
- [ ] demo GIF or short video renders on GitHub
- [ ] Quick Start works for local mode
- [ ] VPS setup points to `config/vps.example.json`
- [ ] Chinese guide matches the current scripts
- [ ] release notes are updated

## GitHub setup

- [ ] repository name uses PocketCLI branding
- [ ] repo description matches the README headline
- [ ] topics include `android`, `self-hosted`, `terminal`, `remote-access`, `developer-tools`, `ai-agents`, `claude-code`
- [ ] first release attaches APK, launcher EXE, and checksums

## Launch copy

- [ ] publish note answers what it is
- [ ] publish note answers who it is for
- [ ] publish note shows the shortest path to try it
- [ ] publish note states current limitations honestly
