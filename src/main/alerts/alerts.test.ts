import { describe, expect, it } from 'vitest'
import { DEFAULT_PREFERENCES, type Preferences, type Snapshot } from '../../shared/types'
import { AlertTracker } from './alerts'

function fakeSnapshot(over: Partial<Snapshot> = {}): Snapshot {
  return {
    serverId: 's1',
    takenAt: 1000,
    reachable: true,
    host: {
      cpuPercent: 10,
      memUsedBytes: 1_000_000_000,
      memTotalBytes: 2_000_000_000,
      diskUsedBytes: 10_000_000_000,
      diskTotalBytes: 50_000_000_000,
      uptimeSeconds: 3600,
      cores: 4
    },
    history: { cpu: [], mem: [] },
    projects: [],
    containers: [],
    undetected: [],
    warnings: [],
    status: 'ok',
    ...over
  }
}

describe('AlertTracker', () => {
  it('does not alert on the first snapshot (silent baseline)', () => {
    let now = 1000
    const tracker = new AlertTracker({ now: () => now, confirmations: 2, minIntervalMs: 1_800_000 })
    const bad = fakeSnapshot({
      status: 'error',
      projects: [{
        id: 'p1',
        name: 'web',
        kind: 'compose',
        containerIds: ['c1'],
        domains: [],
        git: null,
        deployMethod: 'ci-image',
        diskBytes: 0,
        usage: { cpuPercent: 0, memBytes: 0 },
        status: 'error'
      }],
      containers: [{
        id: 'c1',
        name: 'web-1',
        image: 'img',
        state: 'exited',
        exitCode: 1,
        restartPolicy: 'always',
        publishedPorts: []
      }]
    })

    const alerts1 = tracker.observe(bad, DEFAULT_PREFERENCES)
    expect(alerts1).toEqual([])

    // Second consecutive bad snapshot -> confirms error and alerts
    now += 5000
    const alerts2 = tracker.observe(bad, DEFAULT_PREFERENCES)
    expect(alerts2).toHaveLength(1)
    expect(alerts2[0]).toMatchObject({
      serverId: 's1',
      level: 'error'
    })
  })

  it('ignores isolated spikes that do not persist across 2 snapshots', () => {
    let now = 1000
    const tracker = new AlertTracker({ now: () => now, confirmations: 2 })
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, notifications: { ...DEFAULT_PREFERENCES.notifications, warnings: true } }

    const ok = fakeSnapshot()
    const spike = fakeSnapshot({
      status: 'warn',
      projects: [{
        id: 'p1',
        name: 'web',
        kind: 'compose',
        containerIds: [],
        domains: [],
        git: null,
        deployMethod: 'ci-image',
        diskBytes: 0,
        usage: { cpuPercent: 85, memBytes: 0 },
        status: 'warn'
      }]
    })

    tracker.observe(ok, prefs) // baseline
    now += 5000
    expect(tracker.observe(spike, prefs)).toEqual([]) // 1st warning: not confirmed yet
    now += 5000
    expect(tracker.observe(ok, prefs)).toEqual([]) // back to ok: spike was ignored
  })

  it('respects cooldown of 30 min unless the situation worsens from warn to error', () => {
    let now = 1000
    const tracker = new AlertTracker({ now: () => now, confirmations: 2, minIntervalMs: 1_800_000 })
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, notifications: { ...DEFAULT_PREFERENCES.notifications, warnings: true } }

    const ok = fakeSnapshot()
    const warn = fakeSnapshot({
      status: 'warn',
      projects: [{
        id: 'p1',
        name: 'web',
        kind: 'compose',
        containerIds: [],
        domains: [],
        git: null,
        deployMethod: 'ci-image',
        diskBytes: 0,
        usage: { cpuPercent: 85, memBytes: 0 },
        status: 'warn'
      }]
    })
    const err = fakeSnapshot({
      status: 'error',
      projects: [{
        id: 'p1',
        name: 'web',
        kind: 'compose',
        containerIds: ['c1'],
        domains: [],
        git: null,
        deployMethod: 'ci-image',
        diskBytes: 0,
        usage: { cpuPercent: 0, memBytes: 0 },
        status: 'error'
      }],
      containers: [{
        id: 'c1',
        name: 'web-1',
        image: 'img',
        state: 'exited',
        exitCode: 1,
        restartPolicy: 'always',
        publishedPorts: []
      }]
    })

    tracker.observe(ok, prefs)
    now += 5000
    tracker.observe(warn, prefs)
    now += 5000
    const warnAlerts = tracker.observe(warn, prefs)
    expect(warnAlerts).toHaveLength(1)
    expect(warnAlerts[0]?.level).toBe('warn')

    // Same warn 5 min later -> throttled by cooldown
    now += 300_000
    expect(tracker.observe(warn, prefs)).toEqual([])

    // Escalation from warn to error bypasses cooldown once confirmed
    now += 5000
    tracker.observe(err, prefs)
    now += 5000
    const errAlerts = tracker.observe(err, prefs)
    expect(errAlerts).toHaveLength(1)
    expect(errAlerts[0]?.level).toBe('error')
  })

  it('groups multiple issues on the same server into a single alert', () => {
    let now = 1000
    const tracker = new AlertTracker({ now: () => now, confirmations: 1 }) // 1 confirmation to test grouping
    const ok = fakeSnapshot()
    tracker.observe(ok, DEFAULT_PREFERENCES)

    now += 5000
    const multi = fakeSnapshot({
      status: 'error',
      projects: [
        {
          id: 'p1',
          name: 'web',
          kind: 'compose',
          containerIds: ['c1'],
          domains: [],
          git: null,
          deployMethod: 'ci-image',
          diskBytes: 0,
          usage: { cpuPercent: 0, memBytes: 0 },
          status: 'error'
        },
        {
          id: 'p2',
          name: 'api',
          kind: 'compose',
          containerIds: ['c2'],
          domains: [],
          git: null,
          deployMethod: 'ci-image',
          diskBytes: 0,
          usage: { cpuPercent: 0, memBytes: 0 },
          status: 'error'
        }
      ],
      containers: [
        { id: 'c1', name: 'web-1', image: 'img', state: 'exited', exitCode: 1, restartPolicy: 'always', publishedPorts: [] },
        { id: 'c2', name: 'api-1', image: 'img', state: 'exited', exitCode: 1, restartPolicy: 'always', publishedPorts: [] }
      ]
    })

    const alerts = tracker.observe(multi, DEFAULT_PREFERENCES)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.serverId).toBe('s1')
    expect(alerts[0]?.level).toBe('error')
    expect(alerts[0]?.items.length).toBeGreaterThanOrEqual(2)
  })

  it('notifies recovery when enabled, or stays silent when recoveries are disabled', () => {
    let now = 1000
    const tracker = new AlertTracker({ now: () => now, confirmations: 1 })
    const ok = fakeSnapshot()
    const bad = fakeSnapshot({
      status: 'error',
      projects: [{
        id: 'p1',
        name: 'web',
        kind: 'compose',
        containerIds: ['c1'],
        domains: [],
        git: null,
        deployMethod: 'ci-image',
        diskBytes: 0,
        usage: { cpuPercent: 0, memBytes: 0 },
        status: 'error'
      }],
      containers: [{ id: 'c1', name: 'web-1', image: 'img', state: 'exited', exitCode: 1, restartPolicy: 'always', publishedPorts: [] }]
    })

    tracker.observe(ok, DEFAULT_PREFERENCES)
    now += 5000
    tracker.observe(bad, DEFAULT_PREFERENCES)

    // Recovered with recoveries: true
    now += 5000
    const recAlerts = tracker.observe(ok, { ...DEFAULT_PREFERENCES, notifications: { ...DEFAULT_PREFERENCES.notifications, recoveries: true } })
    expect(recAlerts).toHaveLength(1)
    expect(recAlerts[0]?.level).toBe('recovered')

    // Next time with recoveries: false
    now += 5000
    tracker.observe(bad, DEFAULT_PREFERENCES)
    now += 5000
    const noRec = tracker.observe(ok, { ...DEFAULT_PREFERENCES, notifications: { ...DEFAULT_PREFERENCES.notifications, recoveries: false } })
    expect(noRec).toEqual([])
  })

  it('reports auth/hostkey failure as action level once, not repeatedly', () => {
    let now = 1000
    const tracker = new AlertTracker({ now: () => now, confirmations: 1 })
    const ok = fakeSnapshot()
    tracker.observe(ok, DEFAULT_PREFERENCES)

    now += 5000
    const authFailed = fakeSnapshot({
      status: 'error',
      reachable: false,
      host: null,
      error: { kind: 'auth', message: 'Permission denied' }
    })

    const a1 = tracker.observe(authFailed, DEFAULT_PREFERENCES)
    expect(a1).toHaveLength(1)
    expect(a1[0]?.level).toBe('action')

    now += 5000
    const a2 = tracker.observe(authFailed, DEFAULT_PREFERENCES)
    expect(a2).toEqual([])
  })

  it('forgets state when a server is removed', () => {
    const now = 1000
    const tracker = new AlertTracker({ now: () => now, confirmations: 2 })
    const bad = fakeSnapshot({
      status: 'error',
      projects: [{
        id: 'p1',
        name: 'web',
        kind: 'compose',
        containerIds: ['c1'],
        domains: [],
        git: null,
        deployMethod: 'ci-image',
        diskBytes: 0,
        usage: { cpuPercent: 0, memBytes: 0 },
        status: 'error'
      }],
      containers: [{ id: 'c1', name: 'web-1', image: 'img', state: 'exited', exitCode: 1, restartPolicy: 'always', publishedPorts: [] }]
    })

    tracker.observe(bad, DEFAULT_PREFERENCES)
    tracker.forget('s1')

    // After forget, next snapshot is treated as baseline again
    expect(tracker.observe(bad, DEFAULT_PREFERENCES)).toEqual([])
  })

  it('emits nothing when notifications are disabled globally', () => {
    const tracker = new AlertTracker({ confirmations: 1 })
    const bad = fakeSnapshot({ status: 'error', reachable: false, host: null })
    const prefs: Preferences = { ...DEFAULT_PREFERENCES, notifications: { ...DEFAULT_PREFERENCES.notifications, enabled: false } }
    expect(tracker.observe(bad, prefs)).toEqual([])
  })
})
