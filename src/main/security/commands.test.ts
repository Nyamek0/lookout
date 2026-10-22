import { describe, expect, it } from 'vitest'
import { buildCommand } from './commands'
import { PathRegistry } from './pathRegistry'

describe('buildCommand', () => {
  it('builds a restart argv from valid container ids', () => {
    expect(buildCommand('dockerRestart', { ids: ['abcdef123456'] })).toEqual([
      'docker',
      'restart',
      'abcdef123456'
    ])
  })

  it.each([['abc; rm -rf /'], ['--all'], ['$(id)'], ['ABCDEF123456'], ['abc']])(
    'rejects the hostile or malformed container id %s',
    (id) => {
      expect(() => buildCommand('dockerRestart', { ids: [id] })).toThrow()
      expect(() => buildCommand('dockerInspect', { ids: [id] })).toThrow()
    }
  )

  it('rejects an empty id list', () => {
    expect(() => buildCommand('dockerRestart', { ids: [] })).toThrow()
    expect(() => buildCommand('dockerInspect', { ids: [] })).toThrow()
  })

  it('refuses unknown command names', () => {
    expect(() => buildCommand('rm' as never)).toThrow()
  })

  it('reads files only from registered absolute paths', () => {
    const registry = new PathRegistry()
    expect(() => buildCommand('readFile', { path: '/etc/caddy/Caddyfile' }, registry)).toThrow()
    registry.register('/etc/caddy/Caddyfile')
    expect(buildCommand('readFile', { path: '/etc/caddy/Caddyfile' }, registry)).toEqual([
      'cat',
      '--',
      '/etc/caddy/Caddyfile'
    ])
    registry.register('/etc/../etc/shadow')
    expect(() => buildCommand('readFile', { path: '/etc/../etc/shadow' }, registry)).toThrow()
  })

  it('builds logs commands with a bounded tail and a timestamp window', () => {
    expect(buildCommand('dockerLogs', { id: 'abcdef123456', tail: 200 })).toEqual([
      'docker', 'logs', '--timestamps', '--tail', '200', 'abcdef123456'
    ])
    expect(
      buildCommand('dockerLogs', { id: 'abcdef123456', tail: 5, until: '2026-10-21T17:00:00.123Z' })
    ).toEqual([
      'docker', 'logs', '--timestamps', '--tail', '5', '--until', '2026-10-21T17:00:00.123Z', 'abcdef123456'
    ])
    expect(() => buildCommand('dockerLogs', { id: 'abcdef123456', tail: -1 })).toThrow()
    expect(() => buildCommand('dockerLogs', { id: 'abcdef123456', tail: 10, until: '$(id)' })).toThrow()
  })

  it('can follow a container log live, only with --follow', () => {
    expect(
      buildCommand('dockerLogs', { id: 'abcdef123456', tail: 0, since: '2026-10-21T10:00:00.000Z', follow: true })
    ).toEqual([
      'docker', 'logs', '--timestamps', '--follow', '--tail', '0', '--since', '2026-10-21T10:00:00.000Z', 'abcdef123456'
    ])
    expect(buildCommand('dockerLogs', { id: 'abcdef123456', tail: 5 })).not.toContain('--follow')
  })

  it('queries git only inside a registered directory', () => {
    const registry = new PathRegistry()
    expect(() => buildCommand('gitInfo', { dir: '/opt/app', part: 'head' }, registry)).toThrow()
    registry.register('/opt/app')
    expect(buildCommand('gitInfo', { dir: '/opt/app', part: 'remote' }, registry)).toEqual([
      'git', '-C', '/opt/app', 'remote', 'get-url', 'origin'
    ])
  })

  it('disables config-driven code execution when reading git history', () => {
    const registry = new PathRegistry()
    registry.register('/opt/app')
    expect(buildCommand('gitInfo', { dir: '/opt/app', part: 'head' }, registry)).toEqual([
      'git', '-C', '/opt/app', '-c', 'core.fsmonitor=false', '-c', 'log.showSignature=false',
      '-c', 'core.pager=cat', 'log', '-1', '--no-show-signature', '--format=%h%n%cI%n%s%n%D'
    ])
  })

  it('can dump the nginx configuration, read-only', () => {
    expect(buildCommand('nginxConfig')).toEqual(['nginx', '-T'])
  })

  it('has fixed read-only commands for host and docker state', () => {
    expect(buildCommand('procStat')).toEqual(['cat', '/proc/stat'])
    expect(buildCommand('dockerPsIds')[0]).toBe('docker')
  })
})

