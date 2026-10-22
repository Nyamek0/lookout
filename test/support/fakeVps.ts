import { createHash } from 'node:crypto'
import { Server, utils } from 'ssh2'
import type { Connection } from 'ssh2'

export interface FakeResult {
  stdout: string
  code: number
}
export type FakeHandler = (argv: string[]) => FakeResult | Promise<FakeResult>

export interface FakeVps {
  port: number
  fingerprint: string
  keys: { private: string; public: string }
  authAttempts: () => number
  stop(): Promise<void>
}

/** Inverse of shellQuote: splits a command line made of single-quoted words back into argv. */
export function parseArgv(command: string): string[] {
  const argv: string[] = []
  let cur = ''
  let inWord = false
  let quoted = false
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!
    if (quoted) {
      if (ch === "'") quoted = false
      else cur += ch
    } else if (ch === "'") {
      quoted = true
      inWord = true
    } else if (ch === '\\' && command[i + 1] === "'") {
      cur += "'"
      inWord = true
      i++
    } else if (ch === ' ') {
      if (inWord) argv.push(cur)
      cur = ''
      inWord = false
    } else {
      cur += ch
      inWord = true
    }
  }
  if (inWord) argv.push(cur)
  return argv
}

export function fingerprintOf(publicKey: string): string {
  const blob = utils.parseKey(publicKey)
  if (blob instanceof Error) throw blob
  const b64 = createHash('sha256').update(blob.getPublicSSH()).digest('base64').replace(/=+$/, '')
  return `SHA256:${b64}`
}

/** ssh2 1.17 occasionally generates an unparseable ed25519 key (~0.5%): regenerate until it parses. */
export function generateHostKey(): { private: string; public: string } {
  for (;;) {
    const keys = utils.generateKeyPairSync('ed25519')
    if (!(utils.parseKey(keys.private) instanceof Error)) return keys
  }
}

export async function startFakeVps(
  handler: FakeHandler,
  opts: { port?: number; hostKey?: { private: string; public: string } } = {}
): Promise<FakeVps> {
  const keys = opts.hostKey ?? generateHostKey()
  const clients = new Set<Connection>()
  let attempts = 0

  const server = new Server({ hostKeys: [keys.private] }, (client) => {
    clients.add(client)
    client.on('error', () => {})
    client.on('close', () => clients.delete(client))
    client.on('authentication', (ctx) => {
      attempts++
      ctx.accept()
    })
    client.on('ready', () => {
      client.on('session', (accept) => {
        const session = accept()
        session.on('exec', (acceptExec, _reject, info) => {
          const stream = acceptExec()
          void Promise.resolve(handler(parseArgv(info.command))).then((r) => {
            stream.write(r.stdout)
            stream.exit(r.code)
            stream.end()
          })
        })
      })
    })
  })

  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0

  return {
    port,
    fingerprint: fingerprintOf(keys.public),
    keys,
    authAttempts: () => attempts,
    stop: () =>
      new Promise<void>((resolve) => {
        for (const c of clients) c.end()
        server.close(() => resolve())
      })
  }
}
