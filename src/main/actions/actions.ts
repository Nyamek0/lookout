import { randomUUID } from 'node:crypto'
import { buildCommand } from '../security/commands'
import type { PathRegistry } from '../security/pathRegistry'
import type { Exec } from '../ssh/connection'
import { formatCommand } from '../ssh/shellQuote'

import type { PreparedAction } from '../../shared/types'

export type { PreparedAction }

interface Pending {
  serverId: string
  argv: string[]
  count: number
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
    this.pending.set(actionId, { serverId, argv, count: containerIds.length, expiresAt })
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
    try {
      // docker stops containers one after another (10 s grace each): allow for that, and never re-run it.
      const result = await this.getExec(action.serverId).exec(action.argv, {
        timeoutMs: 30_000 + 15_000 * action.count,
        retry: false
      })
      return { ok: result.code === 0, stderr: result.stderr }
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e)
      return { ok: false, stderr: `Outcome unknown: ${why}. Check the containers before trying again.` }
    }
  }
}
