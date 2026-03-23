# PocketCLI v0.1.0

## What it is

PocketCLI is a self-hosted Android and desktop companion for local coding agent CLIs.

## Who it is for

- developers who want to keep agent execution on their own machine
- people who prefer terminal-first workflows
- users who want simple local, LAN, or VPS-backed access without rebuilding the CLI as chat UI

## Quick start

```bat
npm install
start-local-app.bat
```

For Android:

```bat
build-apk.bat
```

For VPS:

1. copy `config/vps.example.json` to `config/vps.json`
2. fill in your VPS values
3. run `start-vps-app.bat`

## Current limitations

- Claude Code is the primary validated workflow today
- Android still uses a WebView-backed terminal shell for fidelity
- public HTTPS is not yet the default path
- screenshot capture is still partly manual
