// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Project, Snapshot } from '../../shared/types'
import '../i18n'
import { Home } from './Home'

const GiB = 1024 ** 3
const project = (over: Partial<Project> & { name: string }): Project => ({
  id: over.name, kind: 'compose', containerIds: [], domains: [], git: null, deployMethod: 'file-copy',
  diskBytes: null, usage: { cpuPercent: 1, memBytes: GiB }, status: 'ok', ...over
})

const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  serverId: 's1',
  takenAt: 1,
  reachable: true,
  host: {
    cpuPercent: 16, memUsedBytes: Math.round(6.3 * GiB), memTotalBytes: 11 * GiB,
    diskUsedBytes: Math.round(0.37 * 197 * GiB), diskTotalBytes: 197 * GiB, uptimeSeconds: 1000, cores: 6
  },
  history: { cpu: [10, 12, 16], mem: [50, 55, 57] },
  projects: [
    project({ name: 'small', usage: { cpuPercent: 1, memBytes: 1 * GiB } }),
    project({ name: 'big', usage: { cpuPercent: 3, memBytes: 3 * GiB } }),
    project({ name: 'medium', usage: { cpuPercent: 2, memBytes: 2 * GiB } })
  ],
  containers: [], undetected: [], warnings: [], status: 'ok', ...over
})

describe('Home', () => {
  it('shows the three host cards', () => {
    render(<Home snapshot={snapshot()} onOpenProject={() => {}} />)
    expect(screen.getByText('16 %')).toBeInTheDocument()
    expect(screen.getByText('6.3 / 11 GB')).toBeInTheDocument()
    expect(screen.getByText('37 %')).toBeInTheDocument()
  })

  it('sorts the consumption list by memory, biggest first', () => {
    render(<Home snapshot={snapshot()} onOpenProject={() => {}} />)
    const rows = screen.getAllByTestId('project-row').map((r) => r.textContent)
    expect(rows[0]).toContain('big')
    expect(rows[1]).toContain('medium')
    expect(rows[2]).toContain('small')
  })

  it('calls out the cause in plain words when a project is orange', () => {
    const s = snapshot({ projects: [project({ name: 'portfolio', status: 'warn', usage: { cpuPercent: 71, memBytes: GiB } }), project({ name: 'fine' })] })
    render(<Home snapshot={s} onOpenProject={() => {}} />)
    const hot = screen.getAllByTestId('project-row').find((r) => r.textContent?.includes('portfolio'))!
    expect(within(hot).getByText('CPU 71 %')).toBeInTheDocument()
    expect(within(hot).getByRole('img', { name: 'warn' })).toBeInTheDocument()
    const fine = screen.getAllByTestId('project-row').find((r) => r.textContent?.includes('fine'))!
    expect(within(fine).queryByText(/CPU \d+ %/)).toBeNull()
  })

  it('opens a project on click', async () => {
    const onOpen = vi.fn()
    render(<Home snapshot={snapshot()} onOpenProject={onOpen} />)
    await userEvent.click(screen.getByText('big'))
    expect(onOpen).toHaveBeenCalledWith('big')
  })

  it('explains when docker is not readable and still shows the host', () => {
    render(<Home snapshot={snapshot({ projects: [], warnings: ['permission_denied'] })} onOpenProject={() => {}} />)
    expect(screen.getByText(/Docker unavailable/)).toBeInTheDocument()
    expect(screen.getByText(/permission/i)).toBeInTheDocument()
    expect(screen.getByText('16 %')).toBeInTheDocument()
  })

  it('shows an unreachable banner without crashing when there are no host metrics', () => {
    render(<Home snapshot={snapshot({ reachable: false, host: null, status: 'error' })} onOpenProject={() => {}} />)
    expect(screen.getByText('Server unreachable')).toBeInTheDocument()
  })

  it('lists what could not be detected', () => {
    render(<Home snapshot={snapshot({ undetected: ['legacy.example.com → 127.0.0.1:9999'] })} onOpenProject={() => {}} />)
    expect(screen.getByText('legacy.example.com → 127.0.0.1:9999')).toBeInTheDocument()
  })
})
