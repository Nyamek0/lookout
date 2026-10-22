import { describe, expect, it } from 'vitest'
import { formatCommand, shellQuote } from './shellQuote'

describe('formatCommand', () => {
  it('shows plain arguments as typed and quotes only the ones that need it', () => {
    expect(formatCommand(['docker', 'restart', 'abcdef123456'])).toBe('docker restart abcdef123456')
    expect(formatCommand(['echo', 'a b', "it's"])).toBe(`echo 'a b' 'it'\\''s'`)
  })
})

describe('shellQuote', () => {
  it('escapes embedded single quotes', () => {
    expect(shellQuote("a'b")).toBe(`'a'\\''b'`)
  })
  it('keeps shell metacharacters literal', () => {
    expect(shellQuote('$(id)')).toBe(`'$(id)'`)
    expect(shellQuote('a; rm -rf /')).toBe(`'a; rm -rf /'`)
  })
  it('quotes the empty string', () => {
    expect(shellQuote('')).toBe(`''`)
  })
})
