import { describe, expect, it } from 'vitest'
import { LogBuffer, stripAnsi } from './logBuffer'

describe('stripAnsi', () => {
  it('removes color and cursor sequences', () => {
    expect(stripAnsi('\u001b[31mERR\u001b[0m')).toBe('ERR')
    expect(stripAnsi('a\u001b[2K\u001b[1Gb')).toBe('ab')
    expect(stripAnsi('plain')).toBe('plain')
  })
})

describe('LogBuffer', () => {
  it('keeps only the latest lines of the live window', () => {
    const b = new LogBuffer(3)
    b.append(['1', '2', '3', '4', '5'])
    expect(b.lines()).toEqual(['3', '4', '5'])
  })

  it('lets older lines extend the window, up to the hard maximum', () => {
    const b = new LogBuffer(3, 5)
    b.append(['3', '4', '5'])
    b.prependOlder(['1', '2'])
    expect(b.lines()).toEqual(['1', '2', '3', '4', '5'])
    b.append(['6'])
    expect(b.lines()).toEqual(['2', '3', '4', '5', '6'])
    b.prependOlder(['0'])
    expect(b.lines()).toEqual(['2', '3', '4', '5', '6'])
    expect(b.canLoadOlder()).toBe(false)
  })

  it('also limits the total size, so a few enormous lines cannot exhaust memory', () => {
    const b = new LogBuffer(100, 1000, 10)
    b.append(['aaaaaa', 'bbbbbb'])
    expect(b.lines()).toEqual(['bbbbbb'])
    b.prependOlder(['cccccc'])
    expect(b.lines()).toEqual(['bbbbbb'])
    expect(b.canLoadOlder()).toBe(false)
  })

  it('still trims to the live window when no older lines were loaded', () => {
    const b = new LogBuffer(2, 10)
    b.append(['a', 'b'])
    b.append(['c'])
    expect(b.lines()).toEqual(['b', 'c'])
    expect(b.canLoadOlder()).toBe(true)
  })
})
