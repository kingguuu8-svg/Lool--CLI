# Lool--CLI

Self-hosted Android and desktop access for local coding agent CLIs.

Small note: `PocketCLI` was the original project name. It is unrelated to any other project using that name, and this codebase was developed independently.

![Lool--CLI hero](docs/assets/pocketcli-hero.svg)

![Lool--CLI demo](docs/assets/pocketcli-demo.gif)

Lool--CLI lets you keep your agent CLI running on your own machine and reach it from:

- a local browser
- a Windows desktop launcher
- an Android app
- a VPS-backed public endpoint

Claude Code and Codex CLI work today. More local agent CLIs can fit the same workflow later.

## Preview

The gallery below uses real emulator captures and the current local terminal UI.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/android-terminal-real.jpg" alt="Android terminal" />
      <br />
      <sub>Android terminal</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/assets/android-settings-real.png" alt="Android settings" />
      <br />
      <sub>Android settings</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/android-menu-real.jpg" alt="Android menu" />
      <br />
      <sub>Android menu</sub>
    </td>
    <td width="50%" valign="top">
      <strong>Capture notes</strong>
      <p>The screenshots here are taken from the emulator and the local browser UI, not placeholder mockups.</p>
      <p>See <a href="docs/screenshots.md">docs/screenshots.md</a> for the current capture notes.</p>
    </td>
  </tr>
</table>

## Quick Start

### 0. Windows one-click launcher

Download `LoolCLI-Launcher-win-x64.exe` from the latest release and run it on Windows.

- If you place it inside the project folder, it auto-detects the repository root on first launch.
- Otherwise, it asks you to pick the project root once and remembers it.
- After that, it gives you one-click buttons for Local, LAN, VPS, Desktop, and Stop Server.

### 1. Local mode

```bat
npm install
start-local-app.bat
```

Open:

- `http://127.0.0.1:3000`

### 2. VPS mode

1. Copy [config/vps.example.json](config/vps.example.json) to `config/vps.json`
2. Fill in your VPS host, SSH user, SSH key path, reverse port, and public URL
3. Run:

```bat
start-vps-app.bat
```

The script will:

- start the local server
- prepare an access token
- configure `nginx` on the VPS
- create the reverse SSH tunnel
- print the public URL and token

### 2.1 Supported CLI presets

The browser UI includes built-in startup presets for:

- `Claude Code`
- `Codex CLI`

You can still leave the preset on `Custom startup` and run any other local CLI command manually.

### 3. Android install

Build:

```bat
build-apk.bat
```

The build script auto-detects a local Android SDK from `ANDROID_SDK_ROOT`, `ANDROID_HOME`, `C:\gps_android_sdk`, or `%LOCALAPPDATA%\Android\Sdk`.

Outputs:

- `dist/android/app-debug.apk`
- `dist/android/app-release.apk` when `android/keystore.properties` exists
- `dist/checksums.txt`
- `dist/launcher/LoolCLI-Launcher-win-x64.exe`

Build the Windows launcher:

```bat
build-launcher.bat
```

## Preview

The gallery below uses real emulator captures and the current local terminal UI.

<table>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/android-terminal-real.jpg" alt="Android terminal" />
      <br />
      <sub>Android terminal</sub>
    </td>
    <td width="50%" valign="top">
      <img src="docs/assets/android-settings-real.png" alt="Android settings" />
      <br />
      <sub>Android settings</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <img src="docs/assets/android-menu-real.jpg" alt="Android menu" />
      <br />
      <sub>Android menu</sub>
    </td>
    <td width="50%" valign="top">
      <strong>Capture notes</strong>
      <p>The screenshots here are taken from the emulator and the local browser UI, not placeholder mockups.</p>
      <p>See <a href="docs/screenshots.md">docs/screenshots.md</a> for the current capture notes.</p>
    </td>
  </tr>
</table>

## Why Lool--CLI

- Keep your own machine as the execution host
- Reach local sessions from phone or desktop
- Use the existing CLI interaction model instead of rebuilding it as chat UI
- Choose local-only, LAN, temporary public tunnel, or VPS-backed access
- Stay self-hosted and simple

## Features

- Multi-session terminal UI in the browser with `xterm.js`
- Local sessions with `node-pty`
- SSH sessions with `ssh2`
- Built-in startup presets and quick actions for Claude Code and Codex CLI
- Android shell app with saved address, token, language, and first-run setup
- Windows desktop launcher for local, LAN, and VPS modes
- Token-protected public mode
- One-command startup scripts for the common paths

## Run Modes

### Local

- Script: [start-local-app.bat](start-local-app.bat)
- Binds to `127.0.0.1:3000`
- Opens the local UI automatically

### LAN

- Script: [start-lan.bat](start-lan.bat)
- Binds to `0.0.0.0:3000`
- Prints the detected LAN URL for phones and tablets

### Temporary public tunnel

- Script: [start-public-app.bat](start-public-app.bat)
- Uses `localhost.run` first
- Falls back to `cloudflared`
- Best for quick sharing and personal testing

### VPS public endpoint

- Script: [start-vps-app.bat](start-vps-app.bat)
- Uses your own VPS as the stable public entrypoint
- Requires a local `config/vps.json`
- Protects public access with a saved token

## Android

The Android app is intentionally a native shell around the existing terminal page.

- Full-screen terminal view
- First-run setup gate
- Saved server address and token
- Manual language switch
- Minimal drawer instead of exposed browser chrome

The goal is to stay close to the CLI interaction model, not to replace it.

## Desktop

The desktop launcher wraps the existing web UI and startup scripts.

- Start local, LAN, and VPS modes
- Stop the running server
- Read the current VPS URL and token from runtime files
- Load the web UI without remembering manual commands

Run:

```bat
start-desktop.bat
```

## Security Notes

- Local and LAN modes do not enforce login by default
- Public access relies on the generated access token
- Keep `config/vps.json`, `.secrets/`, and private keys out of source control
- `ignore TLS errors` in the Android app is only for personal testing with self-signed HTTPS

## Project Layout

- [server/server.js](server/server.js): session server, auth, REST, WebSocket
- [public/](public): browser terminal UI
- [desktop/](desktop): Electron desktop launcher
- [android/](android): Android app project
- [scripts/](scripts): startup helpers, VPS helpers, build helpers
- [docs/](docs): public docs, launch assets, release checklist

## Build and Release

- APK build: [build-apk.bat](build-apk.bat)
- Windows launcher build: [build-launcher.bat](build-launcher.bat)
- Release signing template: [android/keystore.properties.example](android/keystore.properties.example)
- SHA256 output helper: [scripts/write-checksums.ps1](scripts/write-checksums.ps1)
- Release checklist: [docs/release-checklist.md](docs/release-checklist.md)
- Release notes: [docs/release-notes-v0.1.2.md](docs/release-notes-v0.1.2.md)

## Roadmap

- Better screenshot and demo capture pipeline
- HTTPS-first public deployment guide
- Optional presets for common agent CLIs
- Better session presets for projects and startup commands

## Chinese Docs

- [Chinese guide](docs/zh-CN.md)

## Community

- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Support guide](SUPPORT.md)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
