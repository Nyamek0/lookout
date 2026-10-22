# Contributing

Thanks for helping! The project is small and the rules are few.

## Run it

```bash
npm install
npm run dev:demo   # the app against a fake server: no VPS needed
npm run dev        # the app against your own servers
npm test && npm run lint && npm run typecheck
```

`dev:demo` starts a fixture-backed fake VPS on `127.0.0.1:2222` and a throwaway profile (nothing is saved).
The fixtures in `test/fixtures` are command outputs modelled on real servers, with generic names.

## How it is organised

- `src/main`: SSH, collection of data from the server, detection of projects, actions. No UI.
- `src/renderer`: the React interface. It can only call `window.lookout`, whose type is `src/shared/ipc.ts`.
- `src/shared`: types and rules both sides need.

Almost everything on the server side is a **pure parser** (`src/main/collect`) tested against a fixture.

## Rules that matter

1. **Test first.** Write the failing test, watch it fail, then write the code.
2. **The app only runs commands from a fixed list** (`src/main/security/commands.ts`). To read something new from a
   server, add one entry to that table, validate every parameter, and test hostile input (`; rm -rf /`, `$(id)`, `--all`).
3. **Anything that changes a server needs a confirmation that shows the exact command** (`ActionService` +
   `ConfirmDialog`). Never add a one-click action on production.
4. **No secrets on disk.** Passwords and passphrases go to the OS keychain only.
5. **Nothing leaves the user's machine** except SSH to their servers, DNS and a TLS handshake with their own domains.
6. **UI text goes through i18n** (`src/renderer/i18n/en.json` and `fr.json` must have the same keys; a test enforces it).
7. The product name is provisional: it lives in `src/shared/brand.ts`, `package.json` and `electron-builder.yml` only.

## Adding support for another reverse proxy

Implement `ProxyProvider` (`src/main/collect/proxy.ts`): `detect()` returns the sites (hosts, upstream ports, or a static
root) and whether the proxy could be read. Add it to `src/main/collect/providers.ts`. Caddy
(`src/main/collect/caddy.ts`) and nginx (`src/main/collect/nginx.ts`) are the references. Traefik and Apache are welcome.

## Known gaps

- `ProxyJump` hosts in `~/.ssh/config` are listed but cannot be connected to yet.
- Docker rootless and Podman are not supported.
- Windows is built and tested in CI, but the SSH agent and installer are not verified by hand: please report problems.

## Releasing

1. Set the new version in `package.json` and commit it.
2. Tag it and push the tag: `git tag v0.2.0 && git push origin v0.2.0`.
3. The *Release* workflow checks that the tag matches `package.json`, runs the tests and the smoke test, builds the
   Mac (Apple Silicon and Intel) and Windows installers, and prepares a **draft** release with checksums.
4. Open the draft on GitHub, try an installer, then publish it.
