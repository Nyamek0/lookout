export interface Thresholds {
  cpuPercent: number
  memPercentOfHost: number
  host: { cpuPercent: number; memPercent: number; diskPercent: number }
}

// Initial values; meant to become user-configurable later.
export const DEFAULT_THRESHOLDS: Thresholds = {
  cpuPercent: 70,
  memPercentOfHost: 40,
  host: { cpuPercent: 90, memPercent: 85, diskPercent: 85 }
}
