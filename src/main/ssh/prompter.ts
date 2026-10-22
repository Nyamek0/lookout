import { randomUUID } from 'node:crypto'
import type { HostKeyPromptInfo } from '../../shared/ipc'

/** Asks the user whether to trust a new host key; no answer in time counts as "no". */
export class HostKeyPrompter {
  private readonly pending = new Map<string, (accept: boolean) => void>()

  constructor(
    private readonly send: (prompt: HostKeyPromptInfo) => void,
    private readonly timeoutMs = 120_000
  ) {}

  ask(serverId: string, fingerprint: string): Promise<boolean> {
    const promptId = randomUUID()
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => this.settle(promptId, false), this.timeoutMs)
      this.pending.set(promptId, (accept) => {
        clearTimeout(timer)
        resolve(accept)
      })
      this.send({ promptId, serverId, fingerprint })
    })
  }

  answer(promptId: string, accept: boolean): void {
    this.settle(promptId, accept)
  }

  private settle(promptId: string, accept: boolean): void {
    const resolve = this.pending.get(promptId)
    if (!resolve) return
    this.pending.delete(promptId)
    resolve(accept)
  }
}
