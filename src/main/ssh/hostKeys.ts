import { existsSync, readFileSync, writeFileSync } from 'node:fs'

export class HostKeyChangedError extends Error {
  constructor(
    public readonly host: string,
    public readonly expected: string,
    public readonly actual: string
  ) {
    super(`Host key for ${host} changed (expected ${expected}, got ${actual})`)
    this.name = 'HostKeyChangedError'
  }
}

/** Pinned SSH host fingerprints, one per `host:port`. Persisted as JSON when given a file. */
export class KnownHosts {
  private readonly map = new Map<string, string>()

  constructor(private readonly file?: string) {
    if (file && existsSync(file)) {
      try {
        const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
        for (const [k, v] of Object.entries(data)) this.map.set(k, v)
      } catch {
        // a corrupt file is treated as empty: hosts will be asked about again
      }
    }
  }

  get(id: string): string | undefined {
    return this.map.get(id)
  }

  set(id: string, fingerprint: string): void {
    this.map.set(id, fingerprint)
    this.save()
  }

  /** Forget a pinned key (after a legitimate server rebuild): the next connection asks the user again. */
  delete(id: string): void {
    if (this.map.delete(id)) this.save()
  }

  private save(): void {
    if (this.file) writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.map), null, 2))
  }
}

/** ssh2 gives a hex sha256 digest; show it the OpenSSH way. */
export function toFingerprint(hexSha256: string): string {
  return `SHA256:${Buffer.from(hexSha256, 'hex').toString('base64').replace(/=+$/, '')}`
}
