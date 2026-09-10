import { useAuth } from '../lib/useAuth'
import { DEMO } from '../lib/demo'

interface Props {
  year: number
  onYearChange: (year: number) => void
}

export default function Header({ year, onYearChange }: Props) {
  const { user, signOut } = useAuth()
  const now = new Date().getFullYear()
  const years = Array.from({ length: 7 }, (_, i) => now - 3 + i)

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-end gap-[3px] rounded-xl bg-slate-800 p-2">
            <span className="w-1 flex-1 rounded-sm bg-emerald-400" style={{ height: '45%' }} />
            <span className="w-1 flex-1 rounded-sm bg-emerald-400" style={{ height: '75%' }} />
            <span className="w-1 flex-1 rounded-sm bg-rose-400" style={{ height: '100%' }} />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-bold sm:text-base">
              Planilha de Gastos
              {DEMO && (
                <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                  DEMO
                </span>
              )}
            </h1>
            <p className="hidden text-[11px] text-slate-400 sm:block">
              {DEMO ? 'dados fictícios, nada é salvo' : user?.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold outline-none focus:border-emerald-500"
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            className="btn-ghost px-3 py-1.5"
            onClick={() => (DEMO ? window.location.reload() : void signOut())}
          >
            {DEMO ? 'Reiniciar' : 'Sair'}
          </button>
        </div>
      </div>
    </header>
  )
}
