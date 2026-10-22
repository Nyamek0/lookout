const GiB = 1024 ** 3
const trim = (n: number): string => String(Math.round(n * 10) / 10)

/** Gigabytes with one decimal and no trailing .0: 6.3, 11. */
export function formatGB(bytes: number): string {
  return trim(bytes / GiB)
}

/** Readable size in binary units (labelled the way most tools do: KB, MB, GB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let i = -1
  do {
    value /= 1024
    i++
  } while (value >= 1024 && i < units.length - 1)
  return `${trim(value)} ${units[i]}`
}

export function formatPercent(percent: number): string {
  return `${Math.round(percent)} %`
}
