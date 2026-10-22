import { describe, expect, it } from 'vitest'
import { MemorySecretStore } from './secrets'

describe('MemorySecretStore', () => {
  it('stores, returns and deletes a secret', async () => {
    const s = new MemorySecretStore()
    expect(await s.get('a')).toBeUndefined()
    await s.set('a', 'hunter2')
    expect(await s.get('a')).toBe('hunter2')
    await s.delete('a')
    expect(await s.get('a')).toBeUndefined()
  })
})
