import { describe, expect, it } from 'vitest'
import { shellQuote } from './shellQuote'

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
