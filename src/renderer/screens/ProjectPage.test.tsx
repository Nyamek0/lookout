// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ContainerInfo, Project, Snapshot } from '../../shared/types'
import '../i18n'
import { ProjectPage } from './ProjectPage'

const GiB = 1024 ** 3
const container = (over: Partial<ContainerInfo>): ContainerInfo => ({
  id: 'aaaaaaaaaaaa', name: 'app-1', image: 'app', state: 'running', exitCode: 0, restartPolicy: 'no', publishedPorts: [], ...over
})
const project = (over: Partial<Project> = {}): Project => ({
  id: 'app', name: 'app', kind: 'compose', containerIds: ['aaaaaaaaaaaa'], domains: [], git: null,
  deployMethod: 'file-copy', diskBytes: 4.2 * GiB, usage: { cpuPercent: 9, memBytes: 1.4 * GiB }, status: 'ok', ...over
})
const snap = (projects: Project[], containers: ContainerInfo[] = [container({})]): Snapshot => ({
  serverId: 's', takenAt: 1, reachable: true, host: null, history: { cpu: [], mem: [] },
  projects, containers, undetected: [], warnings: [], status: 'ok'
})
const noop = () => {}

describe('ProjectPage', () => {
  it('shows disk, memory and cpu for the project', () => {
    render(<ProjectPage snapshot={snap([project()])} projectId="app" onOpenLogs={noop} onRestart={noop} />)
    expect(screen.getByText('4.2 GB')).toBeInTheDocument()
    expect(screen.getByText('1.4 GB')).toBeInTheDocument()
    expect(screen.getByText('9 %')).toBeInTheDocument()
  })

  it('has Restart and Logs but never a Deploy button', async () => {
    const onRestart = vi.fn()
    const onOpenLogs = vi.fn()
    render(<ProjectPage snapshot={snap([project()])} projectId="app" onOpenLogs={onOpenLogs} onRestart={onRestart} />)
    expect(screen.queryByRole('button', { name: /deploy/i })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Restart' }))
    expect(onRestart).toHaveBeenCalledWith(['aaaaaaaaaaaa'])
    await userEvent.click(screen.getByRole('button', { name: 'Logs' }))
    expect(onOpenLogs).toHaveBeenCalledWith('aaaaaaaaaaaa')
  })

  it('hides containers, logs and restart for a static site', () => {
    const site = project({ id: 'site', name: 'site', kind: 'static', containerIds: [], staticRoot: '/var/www/site', status: 'neutral' })
    render(<ProjectPage snapshot={snap([site], [])} projectId="site" onOpenLogs={noop} onRestart={noop} />)
    expect(screen.queryByRole('button', { name: 'Logs' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Restart' })).toBeNull()
    expect(screen.queryByText('Containers')).toBeNull()
    expect(screen.getByText('/var/www/site')).toBeInTheDocument()
  })

  it('shows domains with certificate state, and flags a dns mismatch or a tls error', () => {
    const domains = [
      { host: 'ok.example.com', ips: ['1.2.3.4'], matchesServer: true, tls: { ok: true, daysLeft: 20 } },
      { host: 'moved.example.com', ips: ['9.9.9.9'], matchesServer: false, tls: { ok: false, error: 'certificate expired' } }
    ]
    render(<ProjectPage snapshot={snap([project({ domains })])} projectId="app" onOpenLogs={noop} onRestart={noop} />)
    expect(screen.getByText('HTTPS valid · 20 days left')).toBeInTheDocument()
    expect(screen.getByText(/DNS points to 9\.9\.9\.9/)).toBeInTheDocument()
    expect(screen.getByText(/certificate expired/)).toBeInTheDocument()
  })

  it('lists the containers with their own state', () => {
    const cs = [container({ id: 'aaaaaaaaaaaa', name: 'app-1' }), container({ id: 'bbbbbbbbbbbb', name: 'db-1', state: 'exited', exitCode: 1 })]
    render(<ProjectPage snapshot={snap([project({ containerIds: ['aaaaaaaaaaaa', 'bbbbbbbbbbbb'] })], cs)} projectId="app" onOpenLogs={noop} onRestart={noop} />)
    const section = screen.getByText('Containers').closest('section')!
    expect(within(section).getByText('db-1')).toBeInTheDocument()
    expect(within(section).getByRole('img', { name: 'error' })).toBeInTheDocument()
  })

  it('presents the deployment method as an estimate and the unknowns as unknown', () => {
    render(<ProjectPage snapshot={snap([project({ deployMethod: 'ci-image' })])} projectId="app" onOpenLogs={noop} onRestart={noop} />)
    expect(screen.getByText(/estimated/)).toBeInTheDocument()
    const section = screen.getByText('Deployment').closest('section')!
    expect(within(section).getAllByText('unknown').length).toBeGreaterThanOrEqual(2)
  })

  it('shows repository, branch and commit when git is known', () => {
    const git = { remote: 'git@github.com:o/r.git', branch: 'production', commit: 'c6b18ce', committedAt: null, subject: 'Merge PR 42' }
    render(<ProjectPage snapshot={snap([project({ git, deployMethod: 'git-pull' })])} projectId="app" onOpenLogs={noop} onRestart={noop} />)
    expect(screen.getByText('git@github.com:o/r.git')).toBeInTheDocument()
    expect(screen.getByText('production')).toBeInTheDocument()
    expect(screen.getByText(/c6b18ce/)).toBeInTheDocument()
  })

  it('does not crash on an unknown project id', () => {
    render(<ProjectPage snapshot={snap([])} projectId="ghost" onOpenLogs={noop} onRestart={noop} />)
    expect(screen.getByText('Project not found')).toBeInTheDocument()
  })
})
