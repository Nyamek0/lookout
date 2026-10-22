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
  private chars = 0
  private budgetHit = false
  private extended = false

  /** `maxChars` bounds the total size too: a few enormous lines must not exhaust memory. */
  constructor(
    private readonly max = 5000,
    private readonly hardMax = 100_000,
    private readonly maxChars = 20_000_000
  ) {}

  append(lines: string[]): void {
    this.data.push(...lines)
    for (const l of lines) this.chars += l.length
    const limit = this.extended ? this.hardMax : this.max
    this.dropFromFront(Math.max(0, this.data.length - limit))
    this.shrinkToBudget()
  }

  prependOlder(lines: string[]): void {
    const room = this.hardMax - this.data.length
    if (lines.length === 0 || room <= 0) return
    const older = lines.slice(-room)
    this.data.unshift(...older)
    for (const l of older) this.chars += l.length
    this.extended = true
    this.shrinkToBudget()
  }

  canLoadOlder(): boolean {
    return this.data.length < this.hardMax && !this.budgetHit
  }

  private dropFromFront(count: number): void {
    for (const dropped of this.data.splice(0, count)) this.chars -= dropped.length
  }

  private shrinkToBudget(): void {
    let count = 0
    let chars = this.chars
    while (chars > this.maxChars && count < this.data.length - 1) chars -= this.data[count++]!.length
    if (count > 0) this.budgetHit = true // memory budget reached: more history would only push lines out again
    this.dropFromFront(count)
  }

  lines(): string[] {
    return [...this.data]
  }
}
