import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { Client, type ConnectConfig } from 'ssh2'
import { HostKeyChangedError, KnownHosts, toFingerprint } from './hostKeys'
import { shellQuote } from './shellQuote'

export type Auth =
  | { type: 'agent' }
  | { type: 'key'; path: string; passphrase?: string }
  | { type: 'password'; password: string }

export interface ExecResult {
  stdout: string
  stderr: string
  code: number
}

export interface Exec {
  exec(argv: string[], opts?: { timeoutMs?: number }): Promise<ExecResult>
  stream(argv: string[], onData: (chunk: string) => void): { stop(): void }
}

export interface SshConnectionOptions {
  host: string
  port: number
  user: string
  auth: Auth | (() => Promise<Auth>)
  knownHosts: KnownHosts
  onUnknownHost: (fingerprint: string) => Promise<boolean>
  readyTimeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 30_000

function agentSocket(): string | undefined {
  return process.platform === 'win32' ? '\\\\.\\pipe\\openssh-ssh-agent' : process.env['SSH_AUTH_SOCK']
}

function expandHome(path: string): string {
  return path.startsWith('~') ? homedir() + path.slice(1) : path
}

export class SshConnection implements Exec {
  private client: Client | null = null
  private ready = false
  private connecting: Promise<void> | null = null

  constructor(private readonly o: SshConnectionOptions) {}

  get connected(): boolean {
    return this.ready
  }

  connect(): Promise<void> {
    if (this.ready) return Promise.resolve()
    if (this.connecting) return this.connecting
    this.connecting = this.open().finally(() => {
      this.connecting = null
    })
    return this.connecting
  }

  close(): void {
    this.ready = false
    this.client?.end()
    this.client = null
  }

  private async open(): Promise<void> {
    // The secret (passphrase/password) is read from the keychain only when we actually connect.
    const auth = typeof this.o.auth === 'function' ? await this.o.auth() : this.o.auth
    const { host, port, user, knownHosts } = this.o
    const id = `${host}:${port}`
    let failure: Error | null = null

    return new Promise<void>((resolve, reject) => {
      const client = new Client()
      const config: ConnectConfig = {
        host,
        port,
        username: user,
        readyTimeout: this.o.readyTimeoutMs ?? 15_000,
        keepaliveInterval: 15_000,
        hostHash: 'sha256',
        hostVerifier: ((hexHash: string, verify: (ok: boolean) => void) => {
          const actual = toFingerprint(hexHash)
          const pinned = knownHosts.get(id)
          if (pinned && pinned !== actual) {
            failure = new HostKeyChangedError(id, pinned, actual)
            return verify(false)
          }
          if (pinned) return verify(true)
          this.o
            .onUnknownHost(actual)
            .then((ok) => {
              if (ok) knownHosts.set(id, actual)
              else failure = new Error(`Host key for ${id} was not trusted`)
              verify(ok)
            })
            .catch((e: unknown) => {
              failure = e instanceof Error ? e : new Error(String(e))
              verify(false)
            })
        }) as unknown as ConnectConfig['hostVerifier']
      }
      if (auth.type === 'agent') config.agent = agentSocket()
      else if (auth.type === 'key') {
        config.privateKey = readFileSync(expandHome(auth.path))
        if (auth.passphrase) config.passphrase = auth.passphrase
      } else config.password = auth.password

      client.on('ready', () => {
        this.client = client
        this.ready = true
        resolve()
      })
      client.on('error', (e) => {
        this.ready = false
        reject(failure ?? e)
      })
      client.on('close', () => {
        if (this.client === client) {
          this.ready = false
          this.client = null
        }
        reject(failure ?? new Error('connection closed'))
      })
      client.connect(config)
    })
  }

  async exec(argv: string[], opts: { timeoutMs?: number } = {}): Promise<ExecResult> {
    const command = argv.map(shellQuote).join(' ')
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    await this.connect()
    try {
      return await this.run(command, timeoutMs)
    } catch (e) {
      if (e instanceof Error && e.message.includes('timed out')) throw e
      this.close()
      await this.connect()
      return this.run(command, timeoutMs)
    }
  }

  private run(command: string, timeoutMs: number): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const client = this.client
      if (!client) return reject(new Error('not connected'))
      client.exec(command, (err, stream) => {
        if (err) return reject(err)
        let stdout = ''
        let stderr = ''
        const timer = setTimeout(() => {
          stream.close()
          reject(new Error(`command timed out after ${timeoutMs} ms`))
        }, timeoutMs)
        stream.on('data', (d: Buffer) => (stdout += d.toString('utf8')))
        stream.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')))
        stream.on('close', (code: number | null) => {
          clearTimeout(timer)
          resolve({ stdout, stderr, code: code ?? 0 })
        })
      })
    })
  }

  stream(argv: string[], onData: (chunk: string) => void): { stop(): void } {
    const command = argv.map(shellQuote).join(' ')
    let stopped = false
    let current: { close(): void } | null = null
    void this.connect().then(() => {
      if (stopped || !this.client) return
      this.client.exec(command, (err, stream) => {
        if (err) return
        current = stream
        if (stopped) return stream.close()
        stream.on('data', (d: Buffer) => onData(d.toString('utf8')))
        stream.stderr.on('data', (d: Buffer) => onData(d.toString('utf8')))
      })
    })
    return {
      stop: () => {
        stopped = true
        current?.close()
      }
    }
  }
}
