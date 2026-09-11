import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MONTHS } from '../lib/format'

interface Props {
  year: number
  period: 'year' | number
  onChange: (p: 'year' | number) => void
}

/**
 * Alterna entre "ano inteiro" e um mês. O menu é renderizado num portal
 * (fixed, direto no <body>) pra nunca ficar por baixo de outro cartão —
 * cada .card tem backdrop-blur, que cria um contexto de empilhamento próprio
 * e "prende" z-index normal lá dentro.
 */
export default function PeriodPicker({ year, period, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  function openPanel() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 144) })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onViewportChange() {
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onViewportChange, true)
      window.removeEventListener('resize', onViewportChange)
    }
  }, [open])

  return (
    <div className="flex rounded-lg bg-slate-800/60 p-0.5 text-xs font-semibold">
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
        ref={btnRef}
        className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition ${
          period !== 'year' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
        }`}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        {period === 'year' ? 'Mês…' : MONTHS[period - 1]}
        <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 opacity-70">
          <path
            d="M5.5 7.5l4.5 4.5 4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
            className="z-50 max-h-56 overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-black/40"
          >
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
          </div>,
          document.body,
        )}
    </div>
  )
}
