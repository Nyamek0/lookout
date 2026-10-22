import { describe, expect, it } from 'vitest'
import { parseSshConfig } from './sshConfig'

describe('parseSshConfig', () => {
  it('reads a simple host block', () => {
    const text = `Host vps
  HostName 203.0.113.10
  User root
`
    expect(parseSshConfig(text)).toEqual([
      { alias: 'vps', hostName: '203.0.113.10', user: 'root', port: 22 }
    ])
  })

  it('ignores wildcard hosts and keeps port, identity file and ProxyJump', () => {
    const text = `Host *
  ServerAliveInterval 30

Host api
  HostName api.example.com
  Port 2222
  IdentityFile ~/.ssh/id_api
  ProxyJump bastion
`
    expect(parseSshConfig(text)).toEqual([
      {
        alias: 'api',
        hostName: 'api.example.com',
        port: 2222,
        identityFile: '~/.ssh/id_api',
        proxyJump: 'bastion'
      }
    ])
  })

  it('falls back to the alias when HostName is missing and follows Include', () => {
    const text = `Include extra.conf
Host solo
`
    const include = (pattern: string) => (pattern === 'extra.conf' ? ['Host other\n  HostName 10.0.0.2\n'] : [])
    expect(parseSshConfig(text, include).map((h) => [h.alias, h.hostName])).toEqual([
      ['other', '10.0.0.2'],
      ['solo', 'solo']
    ])
  })

  it('returns nothing for empty input', () => {
    expect(parseSshConfig('')).toEqual([])
  })
})
