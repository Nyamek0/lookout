// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Status } from '../../shared/types'
import { StatusDot } from './StatusDot'

describe('StatusDot', () => {
  it.each<[Status, string]>([
    ['ok', 'bg-ok'],
    ['warn', 'bg-warn'],
    ['error', 'bg-bad'],
    ['neutral', 'bg-dim']
  ])('shows %s with the %s color and an accessible label', (status, cls) => {
    render(<StatusDot status={status} />)
    const dot = screen.getByRole('img', { name: status })
    expect(dot).toHaveClass(cls)
  })
})
