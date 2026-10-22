// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkline } from './Sparkline'

describe('Sparkline', () => {
  it('does not crash without data', () => {
    const { container } = render(<Sparkline values={[]} width={120} height={30} />)
    expect(container.querySelector('.recharts-line-curve')).toBeNull()
  })

  it('draws a single curve for the values', () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} width={120} height={30} />)
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(1)
  })

  it('has no axes, grid or tooltip: it stays a simple curve', () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} width={120} height={30} />)
    expect(container.querySelector('.recharts-cartesian-axis')).toBeNull()
    expect(container.querySelector('.recharts-cartesian-grid')).toBeNull()
    expect(container.querySelector('.recharts-tooltip-wrapper')).toBeNull()
  })
})
