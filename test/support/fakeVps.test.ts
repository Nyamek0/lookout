import { utils } from 'ssh2'
import { describe, expect, it } from 'vitest'
import { generateHostKey } from './fakeVps'

describe('generateHostKey', () => {
  // ssh2 1.17 sometimes emits an unparseable ed25519 key (~0.5%); the helper must never hand one out.
  it('always returns a key that ssh2 can parse', () => {
    for (let i = 0; i < 400; i++) {
      const keys = generateHostKey()
      expect(utils.parseKey(keys.private)).not.toBeInstanceOf(Error)
    }
  })
})
