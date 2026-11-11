# lookout

Open-source desktop app (Mac + Windows) to see and manage your VPS servers over SSH:
health, CPU/RAM/disk, projects, containers, domains and logs, with **nothing to install on the server**.

> The name is provisional and may change.

## What it does

- Connects to your servers over SSH (agent, key file or password; secrets stay in the OS keychain).
- Finds your projects by itself: Docker Compose projects, containers, the domains your reverse proxy
  serves them on (Caddy and nginx), Git info and static sites.
- **SSL / TLS certificate monitoring**: automatically checks domain certificate expiry dates and warns when a certificate is expiring or expired.
- **Dedicated server tabs**:
  - **Containers**: instant filter search, state, mapped ports, parent project badge, and quick access to logs or restart.
  - **Databases**: automatic detection of database engines (PostgreSQL, MySQL, MariaDB, Redis, MongoDB, ClickHouse, Elasticsearch, RabbitMQ) with health, ports, and volume disk usage.
  - **Deployments**: clear overview of deployment methods (CI Image, Git Pull, File Copy) with repository, active branch, and last commit hash/message.
- **Fleet overview**: summarizes all your VPS servers at a glance, sorting problem servers to the top.
- **Status icon in menu bar / system tray**: reflects the worst status of your fleet, with quick access to each server.
- **Desktop notifications**: alerts you when a project or server fails (with debounce to avoid spam) and takes you directly to the issue on click.
- Lets you read logs (search, full screen, load older history) and restart containers, always after a
  confirmation that shows the exact command.
- **Settings screen**: switch languages (English / French), toggle notification levels (errors, warnings, recoveries), and configure tray behavior on close.
- **Update notifications**: automatically checks GitHub Releases for newer versions and notifies you with a direct download link, plus a manual "Check for updates" option in Settings.
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
  `xattr -cr /Applications/lookout.app`, or right-click the app and choose *Open*. When sending desktop notifications, macOS will ask for notification permission on the first alert.
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
