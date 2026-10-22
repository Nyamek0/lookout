import { describe, expect, it } from 'vitest'
import type { ServerConfig } from '../../shared/types'
import { authFor } from './auth'

const base: ServerConfig = { id: 's', name: 'n', host: 'h', port: 22, user: 'u', authType: 'agent' }

describe('authFor', () => {
  it('uses the agent without any secret', () => {
    expect(authFor(base, undefined)).toEqual({ type: 'agent' })
  })
  it('uses the key file with its passphrase from the keychain', () => {
    expect(authFor({ ...base, authType: 'key', keyPath: '~/.ssh/id' }, 'pp')).toEqual({ type: 'key', path: '~/.ssh/id', passphrase: 'pp' })
    expect(authFor({ ...base, authType: 'key', keyPath: '~/.ssh/id' }, undefined)).toEqual({ type: 'key', path: '~/.ssh/id' })
  })
  it('refuses a key server without a key path', () => {
    expect(() => authFor({ ...base, authType: 'key' }, undefined)).toThrow(/key/i)
  })
  it('uses the password from the keychain', () => {
    expect(authFor({ ...base, authType: 'password' }, 'pw')).toEqual({ type: 'password', password: 'pw' })
    expect(() => authFor({ ...base, authType: 'password' }, undefined)).toThrow(/password/i)
  })
})
