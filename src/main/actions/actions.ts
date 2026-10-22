import { randomUUID } from 'node:crypto'
import { buildCommand } from '../security/commands'
import type { PathRegistry } from '../security/pathRegistry'
import type { Exec } from '../ssh/connection'
import { formatCommand } from '../ssh/shellQuote'

export interface PreparedAction {
  actionId: string
  serverId: string
  label: string
  /** The exact command that will run on the server, as the user will see it. */
  command: string
  expiresAt: number
}

interface Pending {
  serverId: string
  argv: string[]
  expiresAt: number
}

/** Mutating actions are two-step: prepare shows the exact command, confirm runs it once. */
export class ActionService {
  private readonly pending = new Map<string, Pending>()

  constructor(
    private readonly getExec: (serverId: string) => Exec,
    private readonly getPaths: (serverId: string) => PathRegistry,
    private readonly ttlMs = 60_000,
    private readonly now: () => number = Date.now
  ) {}

  prepareRestart(serverId: string, containerIds: string[]): PreparedAction {
    const argv = buildCommand('dockerRestart', { ids: containerIds }, this.getPaths(serverId))
    const actionId = randomUUID()
    const expiresAt = this.now() + this.ttlMs
    this.pending.set(actionId, { serverId, argv, expiresAt })
    return {
      actionId,
      serverId,
      label: `Restart ${containerIds.length} container${containerIds.length === 1 ? '' : 's'}`,
      command: formatCommand(argv),
      expiresAt
    }
  }

  async confirm(actionId: string): Promise<{ ok: boolean; stderr: string }> {
    const action = this.pending.get(actionId)
    if (!action) throw new Error('unknown or already used action')
    this.pending.delete(actionId)
    if (this.now() > action.expiresAt) throw new Error('action expired')
    const result = await this.getExec(action.serverId).exec(action.argv)
    return { ok: result.code === 0, stderr: result.stderr }
  }
}
