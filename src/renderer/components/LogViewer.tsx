import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { stripAnsi } from '../../shared/logBuffer'
import { useLogs } from '../state/useLogs'

const ROW_H = 20
const OVERSCAN = 10
const FALLBACK_HEIGHT = 480
const MAX_LINE = 2000
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T)(\d{2}:\d{2}:\d{2})[\d.]*Z\s?/
const ERROR_WORDS = /\b(error|fatal|exception|critical)\b/i

interface Row {
  time: string
  text: string
}

function parse(raw: string): Row {
  const clean = stripAnsi(raw)
  const m = TIMESTAMP.exec(clean)
  return m ? { time: m[2]!, text: clean.slice(m[0].length) } : { time: '', text: clean }
}

/** Splits a message around the search text; every piece stays a plain React text node. */
function highlight(text: string, query: string): ReactNode {
  if (!query) return text
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, from)) {
    if (at > from) parts.push(text.slice(from, at))
    parts.push(<mark key={at} className="bg-warn/40 text-fg">{text.slice(at, at + q.length)}</mark>)
    from = at + q.length
  }
  parts.push(text.slice(from))
  return parts
}

function LogLines({ serverId, containerId, fullscreen }: { serverId: string; containerId: string; fullscreen: boolean }) {
  const { t } = useTranslation()
  const { lines, loadOlder, canLoadOlder, error } = useLogs(serverId, containerId)
  const box = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [follow, setFollow] = useState(true)
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState(0)
  const [fullLine, setFullLine] = useState<string | null>(null)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out: number[] = []
    lines.forEach((l, i) => {
      if (stripAnsi(l).toLowerCase().includes(q)) out.push(i)
    })
    return out
  }, [lines, query])

  const height = box.current?.clientHeight || FALLBACK_HEIGHT
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN)
  const end = Math.min(lines.length, Math.ceil((scrollTop + height) / ROW_H) + OVERSCAN)

  useEffect(() => {
    const el = box.current
    if (!follow || !el) return
    el.scrollTop = el.scrollHeight
    setScrollTop(el.scrollTop)
  }, [lines.length, follow])

  const goTo = (index: number) => {
    setCurrent(index)
    const line = matches[index]
    if (line === undefined || !box.current) return
    setFollow(false)
    box.current.scrollTop = Math.max(0, line * ROW_H - height / 2)
    setScrollTop(box.current.scrollTop)
  }

  const onScroll = () => {
    const el = box.current
    if (!el) return
    setScrollTop(el.scrollTop)
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 40) setFollow(false)
  }

  const btn = 'rounded-md border border-line px-2 py-1 text-xs hover:bg-panel'
  const rows: ReactNode[] = []
  for (let i = start; i < end; i++) {
    const { time, text } = parse(lines[i]!)
    const shown = text.length > MAX_LINE ? `${text.slice(0, MAX_LINE)}…` : text
    rows.push(
      <div
        key={i}
        data-testid="log-line"
        style={{ top: i * ROW_H, height: ROW_H }}
        className={`absolute left-0 right-0 flex gap-3 overflow-hidden whitespace-pre px-2 text-xs leading-5 ${
          ERROR_WORDS.test(text.slice(0, MAX_LINE)) ? 'text-bad' : 'text-fg'
        }`}
      >
        {time && <span className="shrink-0 text-dim">{time}</span>}
        <span>{highlight(shown, query.trim())}</span>
        {text.length > MAX_LINE && (
          <button type="button" className="shrink-0 text-dim underline" onClick={() => setFullLine(text)}>
            {t('logs.showFull')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          role="searchbox"
          aria-label={t('logs.search')}
          placeholder={t('logs.search')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCurrent(0)
          }}
          className="w-56 rounded-md border border-line bg-ink px-2 py-1 text-xs outline-none focus:border-dim"
        />
        {query.trim() && (
          <>
            <span className="text-xs text-dim">{`${matches.length ? current + 1 : 0} / ${matches.length}`}</span>
            <button type="button" className={btn} aria-label={t('logs.previous')} disabled={!matches.length} onClick={() => goTo((current - 1 + matches.length) % matches.length)}>↑</button>
            <button type="button" className={btn} aria-label={t('logs.next')} disabled={!matches.length} onClick={() => goTo((current + 1) % matches.length)}>↓</button>
          </>
        )}
        <span className="flex-1" />
        {canLoadOlder && <button type="button" className={btn} onClick={() => void loadOlder()}>{t('logs.older')}</button>}
        <button type="button" aria-pressed={follow} className={`${btn} ${follow ? 'border-fg' : ''}`} onClick={() => setFollow((f) => !f)}>
          {t('logs.follow')}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-bad">{t('logs.failed', { message: error })}</p>}

      <div
        ref={box}
        onScroll={onScroll}
        className={`relative min-h-0 overflow-auto rounded-md border border-line bg-black font-mono ${fullscreen ? 'flex-1' : 'h-96'}`}
      >
        {lines.length === 0 && !error ? (
          <p className="p-3 text-xs text-dim">{t('logs.empty')}</p>
        ) : (
          <div style={{ height: lines.length * ROW_H, position: 'relative' }}>{rows}</div>
        )}
      </div>

      {fullLine !== null && (
        <div className="rounded-md border border-line bg-panel p-2">
          <pre data-testid="full-line" className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">{fullLine}</pre>
          <button type="button" className={`${btn} mt-2`} onClick={() => setFullLine(null)}>{t('logs.closeFull')}</button>
        </div>
      )}
    </div>
  )
}

export function LogViewer({
  serverId,
  containers,
  initialContainerId,
  fullscreen,
  onToggleFullscreen
}: {
  serverId: string
  containers: { id: string; name: string }[]
  initialContainerId?: string
  fullscreen: boolean
  onToggleFullscreen: () => void
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(initialContainerId ?? containers[0]?.id)
  const active = containers.find((c) => c.id === selected) ?? containers[0]

  return (
    <div className={fullscreen ? 'fixed inset-0 z-40 flex flex-col gap-2 bg-ink p-4' : 'flex flex-col gap-2'}>
      <div className="flex items-center gap-2">
        <div role="tablist" className="flex flex-1 gap-1 overflow-auto">
          {containers.map((c) => (
            <button
              key={c.id}
              role="tab"
              type="button"
              aria-selected={c.id === active?.id}
              onClick={() => setSelected(c.id)}
              className={`rounded-full border px-3 py-0.5 text-xs ${c.id === active?.id ? 'border-fg text-fg' : 'border-line text-dim'}`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <button type="button" onClick={onToggleFullscreen} className="rounded-md border border-line px-2 py-1 text-xs hover:bg-panel">
          {fullscreen ? t('logs.exitFullscreen') : t('logs.fullscreen')}
        </button>
      </div>
      {active ? (
        <LogLines key={active.id} serverId={serverId} containerId={active.id} fullscreen={fullscreen} />
      ) : (
        <p className="text-sm text-dim">{t('logs.none')}</p>
      )}
    </div>
  )
}
