// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Project, Snapshot } from '../../shared/types'
import '../i18n'
import { Projects } from './Projects'

const p = (over: Partial<Project> & { name: string }): Project => ({
  id: over.name, kind: 'compose', containerIds: ['c1'], domains: [], git: null, deployMethod: 'file-copy',
  diskBytes: null, usage: { cpuPercent: 1, memBytes: 1024 ** 3 }, status: 'ok', ...over
})
const snapshot = (projects: Project[]): Snapshot => ({
  serverId: 's', takenAt: 1, reachable: true, host: null, history: { cpu: [], mem: [] },
  projects, containers: [], undetected: [], warnings: [], status: 'ok'
})

describe('Projects', () => {
  it('lists every project with its state, domains and memory, and opens one on click', async () => {
    const onOpen = vi.fn()
    const projects = [
      p({ name: 'api', domains: [{ host: 'api.example.com', ips: [], matchesServer: null, tls: null }] }),
      p({ name: 'site', kind: 'static', containerIds: [], status: 'neutral' })
    ]
    render(<Projects snapshot={snapshot(projects)} onOpen={onOpen} />)
    expect(screen.getByText('api.example.com')).toBeInTheDocument()
    expect(screen.getByText('1 GB')).toBeInTheDocument()
    expect(screen.getByText('Static site')).toBeInTheDocument()
    await userEvent.click(screen.getByText('api'))
    expect(onOpen).toHaveBeenCalledWith('api')
  })

  it('says so when there is nothing to show', () => {
    render(<Projects snapshot={snapshot([])} onOpen={() => {}} />)
    expect(screen.getByText(/No project found/)).toBeInTheDocument()
  })
})
