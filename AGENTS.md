# AGENTS.md

Guidance for AI coding agents working on **lookout**: an Electron desktop app (Mac + Windows) that monitors and
manages VPS servers over SSH, with nothing installed on the server. Human-facing docs: `README.md`, `CONTRIBUTING.md`.
Design and plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Commands

```bash
npm install
npm run dev:demo     # app against a fixture-backed fake VPS on 127.0.0.1:2222 (LOOKOUT_DEMO=1), throwaway profile
npm run dev          # app against real servers
npm test             # vitest (unit + component tests)
npx vitest run src/main/collect/caddy.test.ts   # a single test file
npm run lint && npm run typecheck
npm run build        # electron-vite build into out/
npm run smoke        # drives the built app end to end in demo mode (run `npm run build` first)
npm run package      # installer for the current platform, in release/
```

Before you call a change done, run `npm run lint && npm run typecheck && npm test`. These are the checks CI runs
on Linux, macOS and Windows (Node 22), followed by `build` and `smoke`.

## Stack

TypeScript (strict, `noUncheckedIndexedAccess`), Electron 45, electron-vite, React 19, Zustand, Tailwind 3,
i18next, recharts, `ssh2`, `@napi-rs/keyring`. Tests: Vitest 4 + Testing Library.

## Layout

- `src/main`: Node side, no UI.
  - `ssh/`: connection, auth (agent / key / password), `~/.ssh/config` parsing, known-hosts pinning, shell quoting.
  - `security/commands.ts`: **the only list of commands the app may run on a server.** `pathRegistry.ts` lists the
    paths those commands may read. `sender.ts` checks which IPC senders are trusted.
  - `collect/`: **pure parsers** for command output (host stats, docker, git, domains). It also holds the reverse-proxy
    providers (`proxy.ts` interface, `caddy.ts`, `nginx.ts`, registered in `providers.ts`).
  - `detect/`: groups containers/sites into projects and works out how each one is deployed.
  - `monitor/`: polling, snapshots and history per server.
  - `actions/`: `ActionService`, which runs mutating actions in two steps (prepare, then confirm).
  - `logs/`: fetching and following logs. `store/`: settings, servers, secrets (keychain).
  - `ipc.ts`: IPC handlers, which validate every argument. `runtime.ts`: wires the services together.
    `index.ts`: entry point (starts the demo when `LOOKOUT_DEMO=1`).
- `src/preload/index.ts`: exposes `window.lookout` through `contextBridge`, and nothing else.
- `src/renderer`: React UI (`screens/`, `components/`, `state/`, `i18n/`). It can only call `window.lookout`.
- `src/shared`: types and rules used by both sides. `ipc.ts` defines `LookoutApi` plus the invoke/event channel
  names. `brand.ts` holds the product name.
- `test/fixtures`: real-looking command outputs with generic names. `test/support/fakeVps.ts` is the fake SSH server.
- `scripts/`: demo server, smoke test, `afterPack.cjs` (ad hoc mac signing), and the packaging test.

## Hard rules (from CONTRIBUTING.md, do not break them)

1. **Test first.** Write the failing test, watch it fail, then implement. Tests sit next to the code as `*.test.ts(x)`.
2. **Fixed command list only.** To read something new from a server, add one entry to the `TABLE` in
   `src/main/security/commands.ts`. Validate every parameter (see `containerId`, `registeredPath`, `timestamp`) and add
   tests with hostile input (`; rm -rf /`, `$(id)`, `--all`). Never build shell strings by hand. Commands are argv arrays,
   quoted by `ssh/shellQuote.ts`.
3. **Every server-changing action needs a confirmation that shows the exact command** (`ActionService.prepare*` +
   `confirm`, rendered by `ConfirmDialog`). No one-click actions that touch production.
4. **No secrets on disk.** Passwords and passphrases go only to the OS keychain (`store/secrets.ts`).
5. **No network traffic** except SSH to the user's servers, DNS, and a TLS handshake with their own domains. No
   telemetry and no third-party calls.
6. **All UI text goes through i18n.** `src/renderer/i18n/en.json` and `fr.json` must have the same keys (a test
   enforces this).
7. **The product name is provisional.** It lives only in `src/shared/brand.ts`, `package.json` and
   `electron-builder.yml` (`appId`/`productName` must match `brand.ts`, and a test enforces this). Never hard-code it.

## Adding a new IPC call

Change these together: the `LookoutApi` type and channel names in `src/shared/ipc.ts`, the handler in `src/main/ipc.ts`
(validate each `unknown` argument), the bridge in `src/preload/index.ts`, and tests (`src/main/ipc.test.ts`). Never
expose `ipcRenderer`, Node or `fs` to the renderer.

## Conventions

- Style: 2 spaces, single quotes, no semicolons, lines up to about 120 characters. Prefix unused args with `_`.
- Main-process code takes its dependencies (exec, clock, stores) as constructor parameters so tests can inject fakes.
  Follow that pattern rather than importing Electron or `ssh2` directly in logic modules.
- Parsers in `collect/` stay pure (string in, typed data out) and are tested against files in `test/fixtures`.
- Tests run in the `node` environment by default. Component tests start with `// @vitest-environment jsdom`.
- Comments explain *why*, in plain English. Commits follow Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`,
  `test:`).
- `brand/`, `out/`, `release/` and `.superpowers/` are not part of the source. Don't edit or commit them.

## Releasing

Bump `version` in `package.json` and commit, then push a matching tag `vX.Y.Z`. The Release workflow builds the
mac arm64/x64 and win x64 installers into a **draft** GitHub release. Builds are not code-signed.

