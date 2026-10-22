import type { Status } from '../../shared/types'

const COLOR: Record<Status, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  error: 'bg-bad',
  neutral: 'bg-dim'
}

export function StatusDot({ status, className = '' }: { status: Status; className?: string }) {
  return <span role="img" aria-label={status} className={`inline-block h-2 w-2 shrink-0 rounded-full ${COLOR[status]} ${className}`} />
}
