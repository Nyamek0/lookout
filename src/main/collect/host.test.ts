import { describe, expect, it } from 'vitest'
import { fixture } from '../../../test/support/fixture'
import { cpuPercent, parseDf, parseMeminfo, parseProcStat, parseUptime } from './host'

describe('host parsers', () => {
  it('reads aggregate cpu counters (idle includes iowait)', () => {
    expect(parseProcStat(fixture('proc-stat.txt'))).toEqual({ idle: 840, total: 1000 })
  })

  it('computes cpu percent between two samples', () => {
    expect(cpuPercent({ idle: 900, total: 1000 }, { idle: 950, total: 1100 })).toBe(50)
    expect(cpuPercent({ idle: 1, total: 100 }, { idle: 1, total: 100 })).toBe(0)
  })

  it('computes used memory from MemAvailable', () => {
    const m = parseMeminfo(fixture('meminfo.txt'))
    expect(m.totalBytes).toBe(12254208 * 1024)
    expect(m.usedBytes).toBe((12254208 - 5701632) * 1024)
  })

  it('reads disk usage from df -PB1', () => {
    expect(parseDf(fixture('df.txt'))).toEqual({ totalBytes: 211243098112, usedBytes: 74027630592 })
  })

  it('reads uptime seconds', () => {
    expect(parseUptime('257395.33 1000.10\n')).toBe(257395.33)
  })

  it('does not throw on empty input', () => {
    expect(parseProcStat('')).toEqual({ idle: 0, total: 0 })
    expect(parseMeminfo('')).toEqual({ totalBytes: 0, usedBytes: 0 })
    expect(parseDf('')).toEqual({ totalBytes: 0, usedBytes: 0 })
    expect(parseUptime('')).toBe(0)
  })
})
