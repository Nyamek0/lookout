// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, Snapshot } from '../../shared/types'
import { i18n } from '../i18n'
import { Deployments } from './Deployments'

function fakeSnapshot(projects: Project[] = []): Snapshot {
  return {
    serverId: 's1',
    takenAt: Date.now(),
    reachable: true,
    host: {
      cpuPercent: 10,
      memUsedBytes: 1_000_000_000,
      memTotalBytes: 2_000_000_000,
      diskUsedBytes: 5_000_000_000,
      diskTotalBytes: 20_000_000_000,
      uptimeSeconds: 3600,
      cores: 2
    },
    history: { cpu: [], mem: [] },
    projects,
    containers: [],
    undetected: [],
    warnings: [],
    status: 'ok'
  }
}

const p1: Project = {
  id: 'compose:api',
  name: 'backend-api',
  kind: 'compose',
  containerIds: ['c1'],
  domains: [],
  git: {
    remote: 'git@github.com:myorg/backend.git',
    branch: 'main',
    commit: 'a1b2c3d4e5f6',
    committedAt: '2026-11-10T14:30:00Z',
    subject: 'feat: add user auth'
  },
  deployMethod: 'git-pull',
  diskBytes: 100_000_000,
  usage: { cpuPercent: 5, memBytes: 100 },
  status: 'ok'
}

const p2: Project = {
  id: 'container:redis',
  name: 'cache',
  kind: 'container',
  containerIds: ['c2'],
  domains: [],
  git: null,
  deployMethod: 'ci-image',
  diskBytes: 50_000_000,
  usage: { cpuPercent: 1, memBytes: 50 },
  status: 'ok'
}

describe('Deployments', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('shows empty message when there are no projects', () => {
    render(<Deployments snapshot={fakeSnapshot([])} onOpenProject={() => {}} />)
    expect(screen.getByText(/no projects deployed/i)).toBeInTheDocument()
  })

  it('lists every project with its deploy method, branch, commit, and repo', () => {
    render(<Deployments snapshot={fakeSnapshot([p1, p2])} onOpenProject={() => {}} />)

    expect(screen.getByText('backend-api')).toBeInTheDocument()
    expect(screen.getByText('Git Pull')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText('a1b2c3d')).toBeInTheDocument()
    expect(screen.getByText('feat: add user auth')).toBeInTheDocument()
    expect(screen.getByText('git@github.com:myorg/backend.git')).toBeInTheDocument()

    expect(screen.getByText('cache')).toBeInTheDocument()
    expect(screen.getByText('CI Image')).toBeInTheDocument()
  })

  it('navigates to project page when clicking on the project row or button', async () => {
    const onOpen = vi.fn()
    render(<Deployments snapshot={fakeSnapshot([p1])} onOpenProject={onOpen} />)

    const btn = screen.getByRole('button', { name: /view project/i })
    await userEvent.click(btn)

    expect(onOpen).toHaveBeenCalledWith('compose:api')
  })
})
