import type { Alert, AlertItem } from '../alerts/alerts'

export interface NotifierOptions {
  show: (options: { title: string; body: string; silent?: boolean; onClick?: () => void }) => void
  t: (key: string, opts?: Record<string, unknown>) => string
  onNavigate: (target: { serverId: string; projectId?: string }) => void
  getServerName: (serverId: string) => string
}

export class Notifier {
  constructor(private readonly o: NotifierOptions) {}

  notify(alert: Alert): void {
    const serverName = this.o.getServerName(alert.serverId)
    const first = alert.items[0]
    const singleProject =
      alert.items.length > 0 &&
      alert.items.every((it) => it.projectId && it.projectId === first?.projectId)
        ? first?.projectName
        : undefined

    let title: string
    if (singleProject) {
      if (alert.level === 'warn') {
        title = this.o.t('notify.warnTitle', { server: serverName, project: singleProject })
      } else if (alert.level === 'recovered') {
        title = this.o.t('notify.recoveredTitle', { server: serverName, project: singleProject })
      } else {
        title = this.o.t('notify.errorTitle', { server: serverName, project: singleProject })
      }
    } else {
      if (alert.level === 'action') {
        title = `${serverName}: ${this.o.t('notify.actionRequired')}`
      } else if (alert.level === 'recovered') {
        title = this.o.t('notify.recoveredTitle', { server: serverName, project: serverName })
      } else {
        title = this.o.t('notify.serverErrorTitle', { server: serverName })
      }
    }

    let body: string
    if (alert.items.length === 1 && first) {
      body = this.formatIssue(first)
    } else if (alert.items.length > 1) {
      body = this.o.t('notify.issues', { count: alert.items.length })
    } else {
      body = ''
    }

    const silent = alert.level === 'warn'
    const onClick = () => {
      this.o.onNavigate({
        serverId: alert.serverId,
        ...(first?.projectId ? { projectId: first.projectId } : {})
      })
    }

    this.o.show({ title, body, silent, onClick })
  }

  notifyTest(): void {
    this.o.show({
      title: this.o.t('notify.testTitle'),
      body: this.o.t('notify.testBody'),
      silent: false,
      onClick: () => {
        this.o.onNavigate({ serverId: '' })
      }
    })
  }

  private formatIssue(item: AlertItem): string {
    const issue = item.issue
    const kind = issue.kind
    if (kind === 'stopped') {
      const container = (issue as { container?: string }).container
      return container ? `${this.o.t('notify.stopped')} (${container})` : this.o.t('notify.stopped')
    }
    if (kind === 'restarting') {
      const container = (issue as { container?: string }).container
      return container ? `${this.o.t('notify.restarting')} (${container})` : this.o.t('notify.restarting')
    }
    if (kind === 'unhealthy') {
      const container = (issue as { container?: string }).container
      return container ? `${this.o.t('notify.unhealthy')} (${container})` : this.o.t('notify.unhealthy')
    }
    if (kind === 'cpu' || kind === 'host-cpu') {
      return this.o.t('notify.cpu', { percent: (issue as { percent?: number }).percent ?? 0 })
    }
    if (kind === 'mem' || kind === 'host-mem') {
      return this.o.t('notify.mem', { percent: (issue as { percent?: number }).percent ?? 0 })
    }
    if ('message' in issue && issue.message) {
      return String(issue.message)
    }
    return item.projectName ?? ''
  }
}
