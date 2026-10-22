# lookout

Open-source desktop app (Mac + Windows) to see and manage your VPS servers over SSH:
health, CPU/RAM/disk, projects, containers, domains and logs, with **nothing to install on the server**.

> The name is provisional and may change.

## What it does

- Connects to your servers over SSH (agent, key file or password; secrets stay in the OS keychain).
- Finds your projects by itself: Docker Compose projects, containers, the domains your reverse proxy
  serves them on (Caddy and nginx), Git info and static sites.
- Shows at a glance whether everything is green, and which project is eating RAM or CPU.
- Lets you read logs (search, full screen, load older history) and restart containers, always after a
  confirmation that shows the exact command.
- It never deploys anything: you keep committing and pushing from your own machine.

## Download

Pick the installer for your system on the [latest release](https://github.com/Nyamek0/lookout/releases/latest):

| Your system | File |
|---|---|
| Mac with Apple Silicon (M1 or newer) | `lookout-<version>-mac-arm64.dmg` |
| Mac with an Intel processor | `lookout-<version>-mac-x64.dmg` |
| Windows 10 / 11 | `lookout-<version>-win-x64.exe` |

The builds are **not code-signed yet**, so the first launch needs one extra step:

- **macOS**: drag the app to *Applications*. If macOS says it is damaged or from an unidentified developer, run
  `xattr -cr /Applications/lookout.app`, or right-click the app and choose *Open*.
- **Windows**: if SmartScreen blocks the installer, choose *More info*, then *Run anyway*.

## Try it without a server

```bash
npm install
npm run dev:demo
```

## Development

```bash
npm run dev        # start the app
npm test           # unit tests
npm run lint && npm run typecheck
npm run package    # installer for the current platform, in release/
```

See [CONTRIBUTING.md](CONTRIBUTING.md). The design and the plan are in `docs/superpowers/`.


## License

MIT
