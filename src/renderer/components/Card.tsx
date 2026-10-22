import type { ReactNode } from 'react'

export function Card({ title, className = '', children }: { title?: string; className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-[10px] border border-line bg-panel p-4 ${className}`}>
      {title && <h4 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-dim">{title}</h4>}
      {children}
    </section>
  )
}
