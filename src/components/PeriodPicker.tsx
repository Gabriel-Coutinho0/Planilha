import { useEffect, useRef, useState } from 'react'
import { MONTHS } from '../lib/format'

interface Props {
  year: number
  period: 'year' | number
  onChange: (p: 'year' | number) => void
}

/**
 * Alterna entre "ano inteiro" e um mês. Usa um menu próprio (não um <select>
 * nativo) pra não abrir aquele popup branco do navegador em cima do tema escuro.
 */
export default function PeriodPicker({ year, period, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative flex rounded-lg bg-slate-800/60 p-0.5 text-xs font-semibold">
      <button
        type="button"
        className={`rounded-md px-2.5 py-1 transition ${
          period === 'year' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
        }`}
        onClick={() => {
          onChange('year')
          setOpen(false)
        }}
      >
        {year}
      </button>
      <button
        type="button"
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
          period !== 'year' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
        }`}
        onClick={() => setOpen((o) => !o)}
      >
        {period === 'year' ? 'Mês…' : MONTHS[period - 1]}
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 opacity-70">
          <path d="M5.5 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-36 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-black/40">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              type="button"
              className={`block w-full px-3 py-1.5 text-left text-xs font-normal transition hover:bg-slate-800 ${
                period === i + 1 ? 'text-emerald-400' : 'text-slate-200'
              }`}
              onClick={() => {
                onChange(i + 1)
                setOpen(false)
              }}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
