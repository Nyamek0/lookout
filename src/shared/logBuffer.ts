// eslint-disable-next-line no-control-regex
const ANSI = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

export function stripAnsi(text: string): string {
  return text.replace(ANSI, '')
}

/**
 * The lines kept in memory for one container. The live window holds `max` lines; loading older
 * history extends it, up to `hardMax`, so a very long log can be read back without exhausting memory.
 */
export class LogBuffer {
  private data: string[] = []
  private extended = false

  constructor(
    private readonly max = 5000,
    private readonly hardMax = 100_000
  ) {}

  append(lines: string[]): void {
    this.data.push(...lines)
    const limit = this.extended ? this.hardMax : this.max
    if (this.data.length > limit) this.data.splice(0, this.data.length - limit)
  }

  prependOlder(lines: string[]): void {
    const room = this.hardMax - this.data.length
    if (lines.length === 0 || room <= 0) return
    this.data.unshift(...lines.slice(-room))
    this.extended = true
  }

  canLoadOlder(): boolean {
    return this.data.length < this.hardMax
  }

  lines(): string[] {
    return [...this.data]
  }
}
