import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { StringDecoder } from 'node:string_decoder'
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
  /** `retry:false` is for commands that must never run twice (a restart): no automatic re-run after a dropped connection. */
  exec(argv: string[], opts?: { timeoutMs?: number; retry?: boolean }): Promise<ExecResult>
  /** `onEnd` is called when the stream could not start or has finished on its own (not when `stop()` is called). */
  stream(argv: string[], onData: (chunk: string) => void, onEnd?: (reason?: string) => void): { stop(): void }
}

export interface SshConnectionOptions {
  host: string
  port: number
  user: string
  auth: Auth | (() => Promise<Auth>)
  knownHosts: KnownHosts
  onUnknownHost: (fingerprint: string) => Promise<boolean>
  readyTimeoutMs?: number
  /** Output kept in memory per command and stream (default 8 MiB): the rest is dropped and reported. */
  maxOutputBytes?: number
}

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_OUTPUT_BYTES = 8 * 1024 * 1024

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
  private inflight = 0

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
          if (knownHosts.corrupt) {
            failure = new Error(knownHosts.corrupt)
            return verify(false)
          }
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

  async exec(argv: string[], opts: { timeoutMs?: number; retry?: boolean } = {}): Promise<ExecResult> {
    const command = argv.map(shellQuote).join(' ')
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    await this.connect()
    this.inflight++
    try {
      return await this.run(command, timeoutMs)
    } catch (e) {
      if (e instanceof Error && e.message.includes('timed out')) throw e
      // Never re-run a command that must not run twice, and never tear down a connection other commands are using.
      if (opts.retry === false || this.inflight > 1) throw e
      this.close()
      await this.connect()
      return this.run(command, timeoutMs)
    } finally {
      this.inflight--
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
        let kept = 0
        let truncated = false
        // Decoders keep a multi-byte character that is cut between two packets until its second half arrives.
        const outDecoder = new StringDecoder('utf8')
        const errDecoder = new StringDecoder('utf8')
        const limit = this.o.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES
        const keep = (d: Buffer): Buffer | null => {
          if (kept >= limit) return (truncated = true), null
          const room = limit - kept
          if (d.length > room) truncated = true
          const part = d.length > room ? d.subarray(0, room) : d
          kept += part.length
          return part
        }
        const timer = setTimeout(() => {
          stream.close()
          reject(new Error(`command timed out after ${timeoutMs} ms`))
        }, timeoutMs)
        stream.on('data', (d: Buffer) => {
          const part = keep(d)
          if (part) stdout += outDecoder.write(part)
        })
        stream.stderr.on('data', (d: Buffer) => {
          const part = keep(d)
          if (part) stderr += errDecoder.write(part)
        })
        stream.on('close', (code: number | null | undefined) => {
          clearTimeout(timer)
          stdout += outDecoder.end()
          stderr += errDecoder.end()
          if (truncated) stderr = stderr ? `${stderr}\noutput truncated` : 'output truncated'
          if (code === undefined || code === null) {
            // No exit status arrived (connection dropped, or killed by a signal): that is not a success.
            const note = 'connection closed before the command reported an exit status'
            return resolve({ stdout, stderr: stderr ? `${stderr}\n${note}` : note, code: 255 })
          }
          resolve({ stdout, stderr, code })
        })
      })
    })
  }

  stream(argv: string[], onData: (chunk: string) => void, onEnd?: (reason?: string) => void): { stop(): void } {
    const command = argv.map(shellQuote).join(' ')
    let stopped = false
    let current: { close(): void } | null = null
    const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))
    this.connect().then(
      () => {
        if (stopped) return
        if (!this.client) return onEnd?.('not connected')
        this.client.exec(command, (err, stream) => {
          if (err) return onEnd?.(err.message)
          current = stream
          if (stopped) return stream.close()
          const outDecoder = new StringDecoder('utf8')
          const errDecoder = new StringDecoder('utf8')
          stream.on('data', (d: Buffer) => onData(outDecoder.write(d)))
          stream.stderr.on('data', (d: Buffer) => onData(errDecoder.write(d)))
          stream.on('close', () => {
            if (!stopped) onEnd?.()
          })
        })
      },
      (e: unknown) => onEnd?.(reason(e))
    )
    return {
      stop: () => {
        stopped = true
        current?.close()
      }
    }
  }
}
