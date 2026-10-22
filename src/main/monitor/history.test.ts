import { describe, expect, it } from 'vitest'
import { History } from './history'

describe('History', () => {
  it('keeps only the latest values up to its capacity', () => {
    const h = new History(3)
    ;[1, 2, 3, 4].forEach((v) => h.push(v))
    expect(h.values()).toEqual([2, 3, 4])
  })
  it('starts empty and returns a copy', () => {
    const h = new History(2)
    expect(h.values()).toEqual([])
    h.push(1)
    h.values().push(99)
    expect(h.values()).toEqual([1])
  })
})
