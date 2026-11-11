import { describe, expect, it } from 'vitest'
import { createMainI18n } from '../i18n'
import type { FleetServerSummary } from '../../shared/fleet'
import { trayMenuTemplate } from './menu'

describe('trayMenuTemplate', () => {
  const i18n = createMainI18n()

  it('shows empty server message when there are no servers', () => {
    const items = trayMenuTemplate([], (k, opts) => i18n.t(k, opts))
    expect(items.some((i) => i.label?.includes('No server'))).toBe(true)
    expect(items.some((i) => i.id === 'open')).toBe(true)
    expect(items.some((i) => i.id === 'quit')).toBe(true)
  })

  it('lists servers with their names and top issue', () => {
    const summary: FleetServerSummary[] = [
      {
        server: { id: 's1', name: 'prod-paris', host: '1.2.3.4', port: 22, user: 'root', authType: 'agent' },
        status: 'error',
        counts: { ok: 0, warn: 0, error: 1, neutral: 0 },
        topIssues: [
          {
            serverId: 's1',
            projectId: 'p1',
            projectName: 'web',
            issue: { kind: 'stopped', status: 'error', container: 'web-1' },
            status: 'error'
          }
        ],
        ageSeconds: 5,
        hostPercent: null
      },
      {
        server: { id: 's2', name: 'dev', host: '5.6.7.8', port: 22, user: 'root', authType: 'agent' },
        status: 'ok',
        counts: { ok: 2, warn: 0, error: 0, neutral: 0 },
        topIssues: [],
        ageSeconds: 10,
        hostPercent: null
      }
    ]

    const items = trayMenuTemplate(summary, (k, opts) => i18n.t(k, opts))
    const serverItem1 = items.find((i) => i.id === 'server:s1')
    expect(serverItem1).toBeDefined()
    expect(serverItem1?.label).toContain('prod-paris')

    const serverItem2 = items.find((i) => i.id === 'server:s2')
    expect(serverItem2).toBeDefined()
    expect(serverItem2?.label).toContain('dev')

    expect(items.find((i) => i.id === 'fleet')?.label).toBe('All servers')
    expect(items.find((i) => i.id === 'open')).toBeDefined()
    expect(items.find((i) => i.id === 'quit')).toBeDefined()
  })

  it('translates into French', () => {
    void i18n.changeLanguage('fr')
    const items = trayMenuTemplate([], (k, opts) => i18n.t(k, opts))
    expect(items.find((i) => i.id === 'fleet')?.label).toBe('Tous les serveurs')
    expect(items.find((i) => i.id === 'quit')?.label).toContain('Quitter')
  })
})
