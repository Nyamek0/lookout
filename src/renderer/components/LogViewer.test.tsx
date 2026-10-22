// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LookoutApi } from '../../shared/ipc'
import type { LogChunk } from '../../shared/types'
import '../i18n'
import { LogViewer } from './LogViewer'

const ts = (n: number) => `2026-10-21T10:00:${String(n % 60).padStart(2, '0')}.000000000Z`
const line = (n: number, text = `message ${n}`) => `${ts(n)} ${text}`
const fetch = vi.fn<(s: string, c: string, o: { tail: number; until?: string }) => Promise<LogChunk>>()
const containers = [{ id: 'aaaaaaaaaaaa', name: 'app-1' }, { id: 'bbbbbbbbbbbb', name: 'queue-1' }]

const mount = (props: Partial<Parameters<typeof LogViewer>[0]> = {}) =>
  render(<LogViewer serverId="s1" containers={containers} fullscreen={false} onToggleFullscreen={() => {}} {...props} />)

beforeEach(() => {
  fetch.mockReset()
  window.lookout = {
    logs: { fetch, follow: async () => () => {} }
  } as unknown as LookoutApi
})

describe('LogViewer', () => {
  it('renders hostile log text as plain text, never as markup', async () => {
    fetch.mockResolvedValue({ lines: [line(1, '<script>alert(1)</script>'), line(2, '<img src=x onerror=alert(1)>')], oldest: ts(1) })
    const { container } = mount()
    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('strips ANSI sequences and marks error lines', async () => {
    fetch.mockResolvedValue({ lines: [line(1, '\u001b[31mERROR boom\u001b[0m'), line(2, 'all fine')], oldest: ts(1) })
    mount()
    const err = await screen.findByText('ERROR boom')
    expect(err.closest('[data-testid="log-line"]')).toHaveClass('text-bad')
    expect(screen.getByText('all fine').closest('[data-testid="log-line"]')).not.toHaveClass('text-bad')
  })

  it('keeps the DOM small with thousands of lines', async () => {
    fetch.mockResolvedValue({ lines: Array.from({ length: 5000 }, (_, i) => line(i)), oldest: ts(0) })
    mount()
    await screen.findAllByTestId('log-line')
    expect(screen.getAllByTestId('log-line').length).toBeLessThan(200)
  })

  it('searches the buffer and counts matches', async () => {
    fetch.mockResolvedValue({ lines: [line(1, 'ok'), line(2, 'ERROR boom'), line(3, 'ok')], oldest: ts(1) })
    mount()
    await screen.findByText('ERROR boom')
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search logs' }), 'boom')
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search logs' }))
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search logs' }), 'zzz')
    expect(screen.getByText('0 / 0')).toBeInTheDocument()
  })

  it('loads older lines before the oldest timestamp and shows them first', async () => {
    fetch.mockResolvedValueOnce({ lines: [line(3), line(4)], oldest: ts(3) })
    mount()
    await screen.findByText('message 3')
    fetch.mockResolvedValueOnce({ lines: [line(1), line(2)], oldest: ts(1) })
    await userEvent.click(screen.getByRole('button', { name: 'Load older' }))
    expect(fetch).toHaveBeenLastCalledWith('s1', 'aaaaaaaaaaaa', { tail: 500, until: ts(3) })
    const rows = await screen.findAllByTestId('log-line')
    expect(rows[0]).toHaveTextContent('message 1')
  })

  it('truncates a huge line quickly and lets you read it in full', async () => {
    const huge = 'x'.repeat(100_000)
    fetch.mockResolvedValue({ lines: [line(1, huge), line(2, 'short')], oldest: ts(1) })
    const started = performance.now()
    mount()
    await screen.findByText('short')
    expect(performance.now() - started).toBeLessThan(1500)
    const rowText = screen.getAllByTestId('log-line')[0]!.textContent ?? ''
    expect(rowText.length).toBeLessThan(5000)
    await userEvent.click(screen.getByRole('button', { name: 'Show full line' }))
    expect(screen.getByTestId('full-line').textContent).toContain(huge)
  })

  it('switches containers with tabs', async () => {
    fetch.mockResolvedValue({ lines: [line(1, 'hello')], oldest: ts(1) })
    mount()
    await screen.findByText('hello')
    await userEvent.click(screen.getByRole('tab', { name: 'queue-1' }))
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('s1', 'bbbbbbbbbbbb', { tail: 500 }))
  })

  it('offers full screen', async () => {
    fetch.mockResolvedValue({ lines: [], oldest: undefined })
    const onToggle = vi.fn()
    const { container } = mount({ fullscreen: true, onToggleFullscreen: onToggle })
    expect(container.firstElementChild).toHaveClass('fixed')
    await userEvent.click(screen.getByRole('button', { name: 'Exit full screen' }))
    expect(onToggle).toHaveBeenCalled()
  })

  it('shows a readable error when logs cannot be read', async () => {
    fetch.mockRejectedValue(new Error('No such container'))
    mount()
    expect(await screen.findByText(/No such container/)).toBeInTheDocument()
  })
})
