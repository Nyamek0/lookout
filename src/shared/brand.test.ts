import { describe, expect, it } from 'vitest'
import { APP_ID, APP_NAME } from './brand'

describe('brand', () => {
  it('uses the provisional lowercase name', () => {
    expect(APP_NAME).toBe('lookout')
  })

  it('derives a reverse-dns app id', () => {
    expect(APP_ID).toBe('com.nyamek0.lookout')
  })
})
