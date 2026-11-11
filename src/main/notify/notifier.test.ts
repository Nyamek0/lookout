import { describe, expect, it, vi } from 'vitest'
import { createMainI18n } from '../i18n'
import type { Alert } from '../alerts/alerts'
import { Notifier } from './notifier'

describe('Notifier', () => {
  it('formats a project error notification in English and French', () => {
    const show = vi.fn()
    const onNavigate = vi.fn()
    const i18n = createMainI18n()
    const notifier = new Notifier({
      show,
      t: (k, opts) => i18n.t(k, opts),
      onNavigate,
      getServerName: () => 'prod-paris'
    })

    const alert: Alert = {
      serverId: 's1',
      level: 'error',
      items: [
        {
          projectId: 'p1',
          projectName: 'backend',
          issue: { kind: 'stopped', status: 'error', container: 'worker-1', exitCode: 137 }
        }
      ]
    }

    notifier.notify(alert)
    expect(show).toHaveBeenCalledTimes(1)
    const callEn = show.mock.calls[0]![0]
    expect(callEn.title).toBe('prod-paris: backend is down')
    expect(callEn.body).toContain('worker-1')
    expect(callEn.silent).toBe(false)

    // French translation
    void i18n.changeLanguage('fr')
    notifier.notify(alert)
    const callFr = show.mock.calls[1]![0]
    expect(callFr.title).toBe('prod-paris : backend est en panne')
  })

  it('marks warnings as silent', () => {
    const show = vi.fn()
    const notifier = new Notifier({
      show,
      t: (_k, _opts) => '',
      onNavigate: () => {},
      getServerName: () => 'prod'
    })

    const alert: Alert = {
      serverId: 's1',
      level: 'warn',
      items: [{ projectId: 'p1', projectName: 'web', issue: { kind: 'cpu', status: 'warn', percent: 85 } }]
    }

    notifier.notify(alert)
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ silent: true }))
  })

  it('triggers onNavigate when the notification is clicked', () => {
    let clickCb: (() => void) | undefined
    const show = vi.fn((opts: { onClick?: () => void }) => {
      clickCb = opts.onClick
    })
    const onNavigate = vi.fn()
    const notifier = new Notifier({
      show,
      t: (_k, _opts) => '',
      onNavigate,
      getServerName: () => 'prod'
    })

    notifier.notify({
      serverId: 's1',
      level: 'error',
      items: [{ projectId: 'p1', projectName: 'web', issue: { kind: 'error', status: 'error' } }]
    })

    expect(clickCb).toBeDefined()
    clickCb!()
    expect(onNavigate).toHaveBeenCalledWith({ serverId: 's1', projectId: 'p1' })
  })

  it('summarises multiple issues with plural count', () => {
    const show = vi.fn()
    const i18n = createMainI18n()
    const notifier = new Notifier({
      show,
      t: (k, opts) => i18n.t(k, opts),
      onNavigate: () => {},
      getServerName: () => 'prod'
    })

    notifier.notify({
      serverId: 's1',
      level: 'error',
      items: [
        { projectId: 'p1', projectName: 'web', issue: { kind: 'error', status: 'error' } },
        { projectId: 'p2', projectName: 'api', issue: { kind: 'error', status: 'error' } }
      ]
    })

    expect(show).toHaveBeenCalledWith(expect.objectContaining({ body: '2 issues' }))
  })

  it('sends a test notification in the current language', () => {
    const show = vi.fn()
    const onNavigate = vi.fn()
    const i18n = createMainI18n()
    const notifier = new Notifier({
      show,
      t: (k, opts) => i18n.t(k, opts),
      onNavigate,
      getServerName: () => 'prod'
    })

    notifier.notifyTest()
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Lookout',
        body: 'Notifications are working properly',
        silent: false
      })
    )
  })

  it('formats cert-expired and cert-expiring notifications', () => {
    const show = vi.fn()
    const i18n = createMainI18n()
    const notifier = new Notifier({
      show,
      t: (k, opts) => i18n.t(k, opts),
      onNavigate: () => {},
      getServerName: () => 'prod-paris'
    })

    notifier.notify({
      serverId: 's1',
      level: 'error',
      items: [
        {
          projectId: 'p1',
          projectName: 'shop',
          issue: { kind: 'cert-expired', status: 'error', domain: 'shop.example.com' }
        }
      ]
    })
    expect(show).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'prod-paris: shop is down',
        body: expect.stringMatching(/SSL certificate expired.*shop\.example\.com/)
      })
    )

    notifier.notify({
      serverId: 's1',
      level: 'warn',
      items: [
        {
          projectId: 'p1',
          projectName: 'shop',
          issue: { kind: 'cert-expiring', status: 'warn', domain: 'shop.example.com', daysLeft: 5 }
        }
      ]
    })
    expect(show).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'prod-paris: warning on shop',
        body: expect.stringMatching(/SSL certificate expires in 5 days.*shop\.example\.com/)
      })
    )
  })

  it('notifies about application updates in English and French', () => {
    const show = vi.fn()
    const onOpen = vi.fn()
    const i18n = createMainI18n()
    const notifier = new Notifier({
      show,
      t: (k, opts) => i18n.t(k, opts),
      onNavigate: () => {},
      getServerName: () => 'prod'
    })

    notifier.notifyUpdate({ version: '0.2.0', onOpen })
    expect(show).toHaveBeenCalledTimes(1)
    const callEn = show.mock.calls[0]![0]
    expect(callEn.title).toBe('Lookout v0.2.0 is available')
    expect(callEn.body).toContain('download')
    expect(callEn.silent).toBe(false)
    callEn.onClick()
    expect(onOpen).toHaveBeenCalledTimes(1)

    void i18n.changeLanguage('fr')
    notifier.notifyUpdate({ version: '0.2.0' })
    const callFr = show.mock.calls[1]![0]
    expect(callFr.title).toBe('Lookout v0.2.0 est disponible')
    expect(callFr.body).toContain('télécharger')
  })
})
