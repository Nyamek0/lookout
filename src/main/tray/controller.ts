import type { FleetServerSummary } from '../../shared/fleet'
import { worst } from '../../shared/status'
import type { Status } from '../../shared/types'
import { trayMenuTemplate, type MenuItemDef } from './menu'

export interface TrayControllerOptions {
  tray: {
    setImage(img: unknown): void
    setToolTip(text: string): void
    setContextMenu(menu: unknown): void
    on(event: string, cb: () => void): void
  }
  createIcon: (status: Status) => unknown
  buildMenu: (items: MenuItemDef[], onAction: (id: string) => void) => unknown
  t: (key: string, opts?: Record<string, unknown>) => string
  onAction: (action: { id: string; serverId?: string }) => void
}

export class TrayController {
  private lastHash: string | null = null
  private currentSummary: FleetServerSummary[] = []

  constructor(private readonly o: TrayControllerOptions) {
    this.o.tray.on('click', () => {
      this.o.onAction({ id: 'open' })
    })
  }

  update(summary: FleetServerSummary[]): void {
    this.currentSummary = summary
    const hash = this.computeHash(summary)
    if (hash === this.lastHash) return
    this.lastHash = hash

    this.render()
  }

  render(): void {
    const statuses = this.currentSummary.map((s) => s.status)
    const worstStatus = worst(statuses)
    const icon = this.o.createIcon(worstStatus)
    this.o.tray.setImage(icon)

    const items = trayMenuTemplate(this.currentSummary, this.o.t)
    const menu = this.o.buildMenu(items, (id) => {
      if (id.startsWith('server:')) {
        this.o.onAction({ id: 'server', serverId: id.slice('server:'.length) })
      } else {
        this.o.onAction({ id })
      }
    })
    this.o.tray.setContextMenu(menu)
  }

  private computeHash(summary: FleetServerSummary[]): string {
    return summary
      .map((s) => `${s.server.id}:${s.status}:${s.topIssues.length}`)
      .join(';')
  }
}
