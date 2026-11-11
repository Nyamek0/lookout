import { describe, expect, it } from 'vitest'
import { compareSemver, isNewerVersion, parseSemver } from './semver'

describe('semver', () => {
  describe('parseSemver', () => {
    it('parses clean major.minor.patch strings', () => {
      expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 })
      expect(parseSemver('0.2.0')).toEqual({ major: 0, minor: 2, patch: 0 })
    })

    it('strips leading v and whitespace', () => {
      expect(parseSemver('v0.2.0')).toEqual({ major: 0, minor: 2, patch: 0 })
      expect(parseSemver('  v1.0.4  ')).toEqual({ major: 1, minor: 0, patch: 4 })
    })

    it('returns null for invalid strings', () => {
      expect(parseSemver('invalid')).toBeNull()
      expect(parseSemver('1.2')).toBeNull()
      expect(parseSemver('')).toBeNull()
    })
  })

  describe('compareSemver', () => {
    it('identifies newer versions correctly across major, minor and patch', () => {
      expect(compareSemver('0.2.0', '0.1.1')).toBeGreaterThan(0)
      expect(compareSemver('1.0.0', '0.9.9')).toBeGreaterThan(0)
      expect(compareSemver('0.1.2', '0.1.1')).toBeGreaterThan(0)
    })

    it('identifies older and equal versions', () => {
      expect(compareSemver('0.1.1', '0.2.0')).toBeLessThan(0)
      expect(compareSemver('0.1.1', '0.1.1')).toBe(0)
      expect(compareSemver('v0.2.0', '0.2.0')).toBe(0)
    })
  })

  describe('isNewerVersion', () => {
    it('returns true only when latest is strictly newer than current', () => {
      expect(isNewerVersion('v0.2.0', '0.1.1')).toBe(true)
      expect(isNewerVersion('0.2.1', '0.2.0')).toBe(true)
      expect(isNewerVersion('1.0.0', '0.2.0')).toBe(true)

      expect(isNewerVersion('v0.2.0', '0.2.0')).toBe(false)
      expect(isNewerVersion('0.1.1', '0.2.0')).toBe(false)
      expect(isNewerVersion('unknown', '0.2.0')).toBe(false)
    })
  })
})

