# lookout

Open-source desktop app (Mac + Windows) to see and manage your VPS servers over SSH:
health, CPU/RAM/disk, projects, containers, domains and logs, with **nothing to install on the server**.

> The name is provisional and may change.

## What it does

- Connects to your servers over SSH (agent, key file or password; secrets stay in the OS keychain).
- Finds your projects by itself: Docker Compose projects, containers, the domains your reverse proxy
  serves them on (Caddy today, nginx next), Git info and static sites.
- Shows at a glance whether everything is green, and which project is eating RAM or CPU.
- Lets you read logs (search, full screen, load older history) and restart containers, always after a
  confirmation that shows the exact command.
- It never deploys anything: you keep committing and pushing from your own machine.

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

## Installing a build

Builds are **not code-signed yet**, so your system will warn you:

- **macOS**: right-click the app, choose *Open*, then confirm (Gatekeeper).
- **Windows**: in the SmartScreen dialog choose *More info*, then *Run anyway*.

Installers must be built on the platform they target (the keychain module is native):
use the *Package* workflow on GitHub, or `npm run package` on each OS.

## License

MIT
