/** A fixed-size window of the latest values, used for the small CPU/RAM curves. */
export class History {
  private data: number[] = []

  constructor(private readonly capacity: number) {}

  push(value: number): void {
    this.data.push(value)
    if (this.data.length > this.capacity) this.data.shift()
  }

  values(): number[] {
    return [...this.data]
  }
}
