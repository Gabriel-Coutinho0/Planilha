import { useMemo, useState, type FormEvent } from 'react'
import { useCollapsed } from '../lib/useCollapsed'
import type { SavingsAccount, TxShare } from '../types'
import { MONTHS, MONTHS_SHORT, formatBRL, formatDate, parseAmount } from '../lib/format'
import type { NewLoan } from '../lib/shares'

interface Props {
  /** Mês em tela: as partes dele (e as atrasadas) aparecem em lista; as futuras só em resumo. */
  year: number
  month: number
  shares: TxShare[]
  /** Contas bancárias (onde o dinheiro pode cair). */
  accounts: SavingsAccount[]
  onSetPaid: (share: TxShare, paid: boolean, accountId: string | null) => Promise<void>
  /** Pessoa → quanto dá pra abater (ela me deve e eu devo a ela). */
  offers?: Map<string, number>
  onSettle?: (person: string) => void
  /** Pessoas já conhecidas (sugestões do cadastro). */
  people?: string[]
  /** Registra um valor avulso (empréstimo) que a pessoa me deve. */
  onAdd?: (p: NewLoan) => Promise<void>
  /** Apaga um valor avulso. */
  onRemove?: (share: TxShare) => Promise<void>
}

const keyOf = (y: number, m: number) => y * 12 + (m - 1)

/** Quem me deve o quê de gastos divididos, com um "pagou" por parte. */
export default function SharesPanel({
  year,
  month,
  shares,
  accounts,
  onSetPaid,
  offers,
  onSettle,
  people = [],
  onAdd,
  onRemove,
}: Props) {
  const [accountId, setAccountId] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [person, setPerson] = useState('')
  const [description, setDescription] = useState('')
  const [total, setTotal] = useState('')
  const [count, setCount] = useState('1')
  const [start, setStart] = useState(`${year}-${String(month).padStart(2, '0')}`)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPaid, setShowPaid] = useState(false)
  const viewKey = keyOf(year, month)

  const groups = useMemo(() => {
    const map = new Map<string, TxShare[]>()
    for (const s of shares) map.set(s.person_name, [...(map.get(s.person_name) ?? []), s])
    return [...map.entries()]
      .map(([name, list]) => {
        const k = (s: TxShare) => keyOf(s.year, s.month)
        const now = list.filter((s) => !s.paid && k(s) <= viewKey)
        const future = list.filter((s) => !s.paid && k(s) > viewKey)
        const done = list.filter((s) => s.paid && k(s) === viewKey)
        return {
          name,
          now,
          future,
          done,
          owed: now.reduce((t, s) => t + Number(s.amount), 0),
          futureTotal: future.reduce((t, s) => t + Number(s.amount), 0),
        }
      })
      .filter((g) => g.now.length > 0 || g.future.length > 0 || (showPaid && g.done.length > 0))
      .sort((a, b) => b.owed - a.owed || b.futureTotal - a.futureTotal)
  }, [shares, showPaid, viewKey])

  const pendingNow = groups.some((g) => g.owed > 0)
  const [open, toggle] = useCollapsed('sec-me-devem', pendingNow)

  const totalNow = groups.reduce((t, g) => t + g.owed, 0)
  const totalFuture = groups.reduce((t, g) => t + g.futureTotal, 0)
  const hasPaid = shares.some((s) => s.paid && keyOf(s.year, s.month) === viewKey)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(total)
    if (!onAdd) return
    if (!person.trim() || !description.trim() || v <= 0) {
      setError('Preencha a pessoa, o que foi e o valor.')
      return
    }
    const [sy, sm] = start.split('-').map(Number)
    setBusy(true)
    setError(null)
    try {
      await onAdd({
        person: person.trim(),
        description: description.trim(),
        total: v,
        count: Math.max(1, Math.floor(Number(count) || 1)),
        startYear: sy,
        startMonth: sm,
      })
      setDescription('')
      setTotal('')
      setCount('1')
      setFormOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="pessoas-me-devem" className="card p-4">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`flex w-full flex-wrap items-start justify-between gap-2 text-left ${open ? 'mb-3' : ''}`}
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-200">
            <span className="mr-1 text-slate-500">{open ? '▾' : '▸'}</span>Pessoas me devem
          </h3>
          {open && (
            <p className="text-xs text-slate-500">
              Partes de {MONTHS[month - 1]} e atrasadas. Marque quando a pessoa pagar.
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-emerald-300">{formatBRL(totalNow)}</p>
          {totalFuture > 0 && (
            <p className="text-[11px] tabular-nums text-slate-500">
              + {formatBRL(totalFuture)} em meses seguintes
            </p>
          )}
        </div>
      </button>

      {open && (
      <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        {accounts.length > 0 && (
          <label className="flex w-full flex-col gap-1 sm:w-auto sm:flex-row sm:items-center sm:gap-1.5">
            Receber na conta
            <select className="input w-full py-1 text-xs sm:w-auto" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Só marcar (não mexe em conta)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {onAdd && (
          <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setFormOpen((o) => !o)}>
            {formOpen ? 'Fechar' : '+ Registrar quem me deve'}
          </button>
        )}
        {hasPaid && (
          <label className="ml-auto flex items-center gap-1.5">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-emerald-500"
              checked={showPaid}
              onChange={(e) => setShowPaid(e.target.checked)}
            />
            mostrar já recebidos
          </label>
        )}
      </div>

      {formOpen && onAdd && (
        <form onSubmit={submit} className="mb-3 space-y-2 rounded-lg bg-slate-800/40 p-2.5">
          <p className="text-[11px] text-slate-500">
            Para dinheiro que você emprestou ou pagou por alguém. Não conta como gasto. Para um gasto seu dividido com
            pessoas, use "dividir" no lançamento.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className="input" list="loan-people" placeholder="Quem me deve (pessoa)" value={person} onChange={(e) => setPerson(e.target.value)} />
            <datalist id="loan-people">
              {people.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <input className="input" placeholder="O que foi (ex: empréstimo, ingresso)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input className="input" inputMode="decimal" placeholder="Valor total 0,00" value={total} onChange={(e) => setTotal(e.target.value)} />
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
              Parcelas
              <input className="input w-20 py-1.5 text-sm" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} title="Em quantas parcelas mensais" />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 sm:col-span-2">
              Primeira parcela em
              <input type="month" className="input w-36 py-1 text-[11px]" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button className="btn-primary w-full py-1.5" disabled={busy}>
            {busy ? 'Salvando…' : 'Registrar'}
          </button>
        </form>
      )}

      {groups.length === 0 ? (
        <p className="text-xs text-slate-500">Ninguém te deve nada agora. 🎉</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.name} className="rounded-lg border border-slate-800 p-2.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-200">{g.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {offers?.get(g.name) && onSettle ? (
                    <button
                      className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                      onClick={() => onSettle(g.name)}
                      title="Você também deve a essa pessoa: dá pra descontar um valor do outro"
                    >
                      abater {formatBRL(offers.get(g.name)!)}
                    </button>
                  ) : null}
                  {g.owed > 0 && <span className="text-sm tabular-nums text-emerald-300">deve {formatBRL(g.owed)}</span>}
                </span>
              </div>
              {(g.now.length > 0 || (showPaid && g.done.length > 0)) && (
                <ul className="divide-y divide-slate-800/70">
                  {[...g.now, ...(showPaid ? g.done : [])].map((s) => {
                    const late = !s.paid && keyOf(s.year, s.month) < viewKey
                    return (
                      <li key={s.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-emerald-500"
                          checked={s.paid}
                          onChange={(e) => void onSetPaid(s, e.target.checked, accountId || null)}
                          title={s.paid ? 'Já pagou (desmarcar devolve o valor)' : 'Marcar que pagou'}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`break-words ${s.paid ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                            {s.description}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            <span className={late ? 'text-rose-400' : ''}>
                              {MONTHS_SHORT[s.month - 1]}/{s.year}
                              {late ? ' · atrasada' : ''}
                            </span>
                            {s.paid && s.paid_on ? ` · recebido em ${formatDate(s.paid_on)}` : ''}
                            {s.paid && s.account_id
                              ? ` · caiu em ${accounts.find((a) => a.id === s.account_id)?.name ?? 'conta'}`
                              : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 tabular-nums ${s.paid ? 'text-slate-500' : 'text-slate-200'}`}>
                          {formatBRL(Number(s.amount))}
                        </span>
                        {onRemove && !s.transaction_id && !s.id.startsWith('fixed:') && (
                          <button
                            className="btn-danger shrink-0 px-1.5 py-0.5 text-[11px]"
                            onClick={() => void onRemove(s)}
                            title="Apagar este valor avulso"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
              {g.future.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-500">
                  + {g.future.length} {g.future.length === 1 ? 'parcela' : 'parcelas'} nos meses seguintes ·{' '}
                  {formatBRL(g.futureTotal)} (aparecem no mês de cada uma)
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      </>
      )}
    </section>
  )
}
