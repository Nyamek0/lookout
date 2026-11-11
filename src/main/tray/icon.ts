import type { Status } from '../../shared/types'

export const STATUS_COLORS: Record<Status, [number, number, number, number]> = {
  ok: [61, 220, 132, 255], // #3ddc84
  warn: [255, 176, 32, 255], // #ffb020
  error: [255, 92, 92, 255], // #ff5c5c
  neutral: [102, 102, 102, 255] // #666666
}

export function dotBitmap(status: Status, size: number): Buffer {
  const buf = Buffer.alloc(size * size * 4)
  const [r, g, b, a] = STATUS_COLORS[status]
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.42

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= radius) {
        buf[idx] = r
        buf[idx + 1] = g
        buf[idx + 2] = b
        buf[idx + 3] = a
      } else {
        buf[idx + 3] = 0 // transparent
      }
    }
  }

  return buf
}
