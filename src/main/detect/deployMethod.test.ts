import { describe, expect, it } from 'vitest'
import type { GitInfo } from '../../shared/types'
import { estimateDeployMethod } from './deployMethod'

const git: GitInfo = { remote: 'git@github.com:o/r.git', branch: 'main', commit: 'abc1234', committedAt: null, subject: null }

describe('estimateDeployMethod', () => {
  it('detects images pulled from a registry', () => {
    expect(estimateDeployMethod(['ghcr.io/acme/x:sha-1', 'mysql:8'], null)).toBe('ci-image')
    expect(estimateDeployMethod(['localhost:5000/app:1'], git)).toBe('ci-image')
  })
  it('does not mistake docker hub images for a registry', () => {
    expect(estimateDeployMethod(['postgres:16', 'nyamek0/app:1'], null)).toBe('file-copy')
  })
  it('falls back to git-pull when the project folder is a git checkout', () => {
    expect(estimateDeployMethod(['portfolio:a1b2c3d'], git)).toBe('git-pull')
  })
  it('falls back to file-copy otherwise', () => {
    expect(estimateDeployMethod(['legacy-app:latest'], null)).toBe('file-copy')
    expect(estimateDeployMethod([], null)).toBe('file-copy')
  })
})
