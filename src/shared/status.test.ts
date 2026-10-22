import { describe, expect, it } from 'vitest'
import { containerStatus, serverStatus, withThresholds, worst } from './status'
import type { ContainerInfo } from './types'

const base: ContainerInfo = {
  id: 'abcdef123456',
  name: 'app',
  image: 'app:latest',
  state: 'running',
  exitCode: 0,
  restartPolicy: 'no',
  publishedPorts: []
}
const c = (over: Partial<ContainerInfo>): ContainerInfo => ({ ...base, ...over })

describe('containerStatus', () => {
  it('treats a clean one-shot exit as neutral, not red', () => {
    expect(containerStatus(c({ state: 'exited', exitCode: 0, restartPolicy: 'no' }))).toBe('neutral')
  })
  it('flags a non-zero exit as error', () => {
    expect(containerStatus(c({ state: 'exited', exitCode: 1 }))).toBe('error')
  })
  it('flags a stopped container that should always run as error', () => {
    expect(containerStatus(c({ state: 'exited', exitCode: 0, restartPolicy: 'unless-stopped' }))).toBe('error')
  })
  it('flags unhealthy and restarting containers as error', () => {
    expect(containerStatus(c({ health: 'unhealthy' }))).toBe('error')
    expect(containerStatus(c({ state: 'restarting' }))).toBe('error')
  })
  it('flags a container that was created but never started', () => {
    // e.g. "port is already allocated": docker leaves it in `created` with exit code 128
    expect(containerStatus(c({ state: 'created', exitCode: 128 }))).toBe('error')
    expect(containerStatus(c({ state: 'created', exitCode: 0, restartPolicy: 'always' }))).toBe('error')
    expect(containerStatus(c({ state: 'created', exitCode: 0, restartPolicy: 'no' }))).toBe('neutral')
  })
  it('is ok when running healthy or without a healthcheck', () => {
    expect(containerStatus(c({ health: 'healthy' }))).toBe('ok')
    expect(containerStatus(c({}))).toBe('ok')
  })
})

describe('worst', () => {
  it('picks the worst status and ignores neutral', () => {
    expect(worst(['ok', 'neutral', 'warn'])).toBe('warn')
    expect(worst(['ok', 'error', 'warn'])).toBe('error')
  })
  it('is neutral for nothing or only neutral', () => {
    expect(worst([])).toBe('neutral')
    expect(worst(['neutral', 'neutral'])).toBe('neutral')
  })
})

describe('withThresholds', () => {
  it('turns ok into warn only above the CPU threshold', () => {
    expect(withThresholds('ok', { cpuPercent: 71, memPercentOfHost: 1 })).toBe('warn')
    expect(withThresholds('ok', { cpuPercent: 70, memPercentOfHost: 1 })).toBe('ok')
  })
  it('turns ok into warn above the memory threshold', () => {
    expect(withThresholds('ok', { cpuPercent: 1, memPercentOfHost: 41 })).toBe('warn')
  })
  it('never softens an error', () => {
    expect(withThresholds('error', { cpuPercent: 0, memPercentOfHost: 0 })).toBe('error')
  })
})

describe('serverStatus', () => {
  it('is error when unreachable', () => {
    expect(serverStatus([], null)).toBe('error')
  })
  it('is warn when the host is under pressure', () => {
    expect(serverStatus(['ok'], { cpuPercent: 10, memPercent: 86, diskPercent: 10 })).toBe('warn')
  })
  it('follows the worst project', () => {
    expect(serverStatus(['ok', 'error'], { cpuPercent: 1, memPercent: 1, diskPercent: 1 })).toBe('error')
  })
})
