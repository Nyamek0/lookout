// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { APP_NAME } from '../shared/brand'
import { App } from './App'

describe('App', () => {
  it('shows the app name', () => {
    render(<App />)
    expect(screen.getByText(APP_NAME)).toBeInTheDocument()
  })
})
