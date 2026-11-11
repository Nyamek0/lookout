import { describe, expect, it } from 'vitest'
import { dotBitmap, STATUS_COLORS } from './icon'

describe('dotBitmap', () => {
  it('draws a circular bitmap with transparent corners and colored center', () => {
    const size = 16
    const buf = dotBitmap('error', size)
    expect(buf.length).toBe(size * size * 4)

    // Corner (0, 0) should be transparent (alpha = 0)
    expect(buf[3]).toBe(0)

    // Center pixel (8, 8) should be colored with bad/error color and alpha 255
    const centerIdx = (8 * size + 8) * 4
    const [r, g, b, a] = STATUS_COLORS.error
    expect(buf[centerIdx]).toBe(r)
    expect(buf[centerIdx + 1]).toBe(g)
    expect(buf[centerIdx + 2]).toBe(b)
    expect(buf[centerIdx + 3]).toBe(a)
  })

  it('supports all statuses: ok, warn, error, neutral', () => {
    for (const st of ['ok', 'warn', 'error', 'neutral'] as const) {
      const buf = dotBitmap(st, 16)
      const centerIdx = (8 * 16 + 8) * 4
      const [r, g, b, a] = STATUS_COLORS[st]
      expect(buf[centerIdx]).toBe(r)
      expect(buf[centerIdx + 1]).toBe(g)
      expect(buf[centerIdx + 2]).toBe(b)
      expect(buf[centerIdx + 3]).toBe(a)
    }
  })
})
