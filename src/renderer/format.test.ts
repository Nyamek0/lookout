import { describe, expect, it } from 'vitest'
import { formatBytes, formatGB, formatPercent } from './format'

const GiB = 1024 ** 3

describe('format', () => {
  it('shows gigabytes with one decimal, dropping a trailing .0', () => {
    expect(formatGB(6.3 * GiB)).toBe('6.3')
    expect(formatGB(11 * GiB)).toBe('11')
  })
  it('picks a readable unit for any size', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(120 * 1024 ** 2)).toBe('120 MB')
    expect(formatBytes(3.1 * GiB)).toBe('3.1 GB')
  })
  it('rounds percentages to whole numbers with a space before the sign', () => {
    expect(formatPercent(36.6)).toBe('37 %')
    expect(formatPercent(0)).toBe('0 %')
  })
})
