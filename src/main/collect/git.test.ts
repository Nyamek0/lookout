import { describe, expect, it } from 'vitest'
import { parseGitInfo } from './git'

describe('parseGitInfo', () => {
  const head = 'c6b18ce\n2026-10-07T18:02:54+00:00\nMerge pull request #42 from acme/master\nHEAD -> production, origin/production\n'

  it('reads commit, date, subject and branch', () => {
    expect(parseGitInfo(head, 'git@github.com:acme/shop.git\n')).toEqual({
      remote: 'git@github.com:acme/shop.git',
      branch: 'production',
      commit: 'c6b18ce',
      committedAt: '2026-10-07T18:02:54+00:00',
      subject: 'Merge pull request #42 from acme/master'
    })
  })

  it('has no branch on a detached HEAD', () => {
    expect(parseGitInfo('abc1234\n2026-10-07T18:02:54+00:00\nfix\nHEAD\n').branch).toBeNull()
  })

  it('strips credentials embedded in a remote url', () => {
    expect(parseGitInfo(head, 'https://user:ghp_secret@github.com/o/r.git\n').remote).toBe(
      'https://github.com/o/r.git'
    )
  })

  it('returns nulls for empty output', () => {
    expect(parseGitInfo('')).toEqual({ remote: null, branch: null, commit: null, committedAt: null, subject: null })
  })
})
