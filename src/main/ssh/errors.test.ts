import { describe, expect, it } from 'vitest'
import { classifyConnectError } from './errors'
import { HostKeyChangedError } from './hostKeys'

const withProps = (message: string, props: Record<string, unknown>) => Object.assign(new Error(message), props)

describe('classifyConnectError', () => {
  it('tells apart a changed key and a key the user refused', () => {
    expect(classifyConnectError(new HostKeyChangedError('h:22', 'a', 'b')).kind).toBe('hostkey-changed')
    expect(classifyConnectError(new Error('Host key for h:22 was not trusted')).kind).toBe('hostkey-refused')
  })

  it('recognises authentication problems, including a missing stored secret', () => {
    expect(classifyConnectError(withProps('All configured authentication methods failed', { level: 'client-authentication' })).kind).toBe('auth')
    expect(classifyConnectError(new Error('No password stored for server "x"')).kind).toBe('auth')
    expect(classifyConnectError(new Error('Server "x" uses a key but has no key file')).kind).toBe('auth')
  })

  it('recognises network problems', () => {
    expect(classifyConnectError(withProps('connect ECONNREFUSED 1.2.3.4:22', { code: 'ECONNREFUSED' })).kind).toBe('network')
    expect(classifyConnectError(new Error('Timed out while waiting for handshake')).kind).toBe('network')
    expect(classifyConnectError(withProps('getaddrinfo ENOTFOUND h', { code: 'ENOTFOUND' })).kind).toBe('network')
  })

  it('keeps the message and falls back to other', () => {
    expect(classifyConnectError(new Error('boom'))).toEqual({ kind: 'other', message: 'boom' })
    expect(classifyConnectError('plain string')).toEqual({ kind: 'other', message: 'plain string' })
  })
})
