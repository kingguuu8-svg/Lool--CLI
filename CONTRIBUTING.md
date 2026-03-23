# Contributing to PocketCLI

Thanks for your interest in PocketCLI.

## Before you start

- Read the [README](README.md) first.
- Use the issue tracker for bugs, feature requests, and setup friction.
- Keep changes focused. Small pull requests are easier to review and merge.

## Good first contributions

- improve docs or screenshots
- tighten startup scripts
- improve Android setup and settings flow
- validate another local agent CLI workflow
- fix Windows, LAN, or VPS edge cases

## Development notes

- Browser UI lives in `public/`
- Session server lives in `server/`
- Desktop launcher lives in `desktop/`
- Android app lives in `android/`
- Helper scripts live in `scripts/`

## Pull request checklist

- explain the user-facing problem you are solving
- keep secrets, runtime files, and local configs out of the commit
- update docs if behavior changes
- include screenshots for UI changes when possible
- mention limits or follow-up work clearly

## Security and privacy

Do not commit:

- private keys
- local tokens
- `config/vps.json`
- `.runtime/` contents
- `.secrets/` contents
- signed keystores

Please use the process in [SECURITY.md](SECURITY.md) for sensitive issues.
