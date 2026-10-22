import { useMemo, useState, type FormEvent } from 'react'
import type { Debt, DebtSettlement, SavingsAccount } from '../types'
import type { NewDebt } from '../lib/debts'
import { MONTHS, MONTHS_SHORT, formatBRL, formatDate, parseAmount } from '../lib/format'
import CategoryOptions from './CategoryOptions'

interface Props {
  /** Mês em tela: as parcelas dele (e as atrasadas) aparecem em lista; as futuras só em resumo. */
  year: number
  month: number
  debts: Debt[]
  settlements: DebtSettlement[]
  /** Contas bancárias (de onde o dinheiro pode sair). */
  accounts: SavingsAccount[]
  /** Pessoas já conhecidas (sugestões). */
  people: string[]
  /** Pessoa → quanto dá pra abater (ela me deve e eu devo a ela). */
  offers: Map<string, number>
  onAdd: (p: NewDebt) => Promise<void>
  onSetPaid: (d: Debt, paid: boolean, accountId: string | null) => Promise<void>
  onRemove: (d: Debt) => Promise<void>
  onSettle: (person: string) => void
  onUndoSettle: (s: DebtSettlement) => Promise<void>
}

const keyOf = (y: number, m: number) => y * 12 + (m - 1)
const pad = (n: number) => String(n).padStart(2, '0')

/** Quanto eu devo a cada pessoa, com um "paguei" por parcela, mais o cadastro de novas dívidas. */
export default function DebtsPanel({
  year,
  month,
  debts,
  settlements,
  accounts,
  people,
  offers,
  onAdd,
  onSetPaid,
  onRemove,
  onSettle,
  onUndoSettle,
}: Props) {
  const [accountId, setAccountId] = useState('')
  const [showPaid, setShowPaid] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [kind, setKind] = useState<'purchase' | 'loan'>('purchase')
  const [person, setPerson] = useState('')
  const [description, setDescription] = useState('')
  const [total, setTotal] = useState('')
  const [count, setCount] = useState('1')
  const [start, setStart] = useState(`${year}-${pad(month)}`)
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const viewKey = keyOf(year, month)

  const groups = useMemo(() => {
    const map = new Map<string, Debt[]>()
    for (const d of debts) map.set(d.person_name, [...(map.get(d.person_name) ?? []), d])
    return [...map.entries()]
      .map(([name, list]) => {
        const k = (d: Debt) => keyOf(d.year, d.month)
        const sorted = [...list].sort((a, b) => k(a) - k(b))
        const now = sorted.filter((d) => !d.paid && k(d) <= viewKey)
        const future = sorted.filter((d) => !d.paid && k(d) > viewKey)
        const done = sorted.filter((d) => d.paid && k(d) === viewKey)
        return {
          name,
          now,
          future,
          done,
          owed: now.reduce((t, d) => t + Number(d.amount), 0),
          futureTotal: future.reduce((t, d) => t + Number(d.amount), 0),
        }
      })
      .filter((g) => g.now.length > 0 || g.future.length > 0 || (showPaid && g.done.length > 0))
      .sort((a, b) => b.owed - a.owed || b.futureTotal - a.futureTotal)
  }, [debts, showPaid, viewKey])

  const totalNow = groups.reduce((t, g) => t + g.owed, 0)
  const totalFuture = groups.reduce((t, g) => t + g.futureTotal, 0)
  const hasPaid = debts.some((d) => d.paid && keyOf(d.year, d.month) === viewKey)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(total)
    const n = Math.max(1, Math.floor(Number(count) || 1))
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
        count: n,
        startYear: sy,
        startMonth: sm,
        kind,
        category: kind === 'purchase' ? category || null : null,
      })
      setDescription('')
      setTotal('')
      setCount('1')
      setCategory('')
      setFormOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="eu-devo" className="card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Eu devo</h3>
          <p className="text-xs text-slate-500">
            Parcelas de {MONTHS[month - 1]} e atrasadas. Marque quando você pagar.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-rose-300">{formatBRL(totalNow)}</p>
          {totalFuture > 0 && (
            <p className="text-[11px] tabular-nums text-slate-500">+ {formatBRL(totalFuture)} em meses seguintes</p>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        {accounts.length > 0 && (
          <label className="flex items-center gap-1.5">
            Pagar com a conta
            <select className="input py-1 text-xs" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Só marcar (não mexe em conta)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="btn-ghost px-2.5 py-1 text-xs" onClick={() => setFormOpen((o) => !o)}>
          {formOpen ? 'Fechar' : '+ Registrar dívida'}
        </button>
        {hasPaid && (
          <label className="ml-auto flex items-center gap-1.5">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-emerald-500"
              checked={showPaid}
              onChange={(e) => setShowPaid(e.target.checked)}
            />
            mostrar já pagas
          </label>
        )}
      </div>

      {formOpen && (
        <form onSubmit={submit} className="mb-3 space-y-2 rounded-lg bg-slate-800/40 p-2.5">
          <div className="flex flex-wrap gap-3 text-xs text-slate-300">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="debt-kind" className="accent-emerald-500" checked={kind === 'purchase'} onChange={() => setKind('purchase')} />
              Compra no cartão de outra pessoa
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="debt-kind" className="accent-emerald-500" checked={kind === 'loan'} onChange={() => setKind('loan')} />
              Empréstimo / dívida avulsa
            </label>
          </div>
          <p className="text-[11px] text-slate-500">
            {kind === 'purchase'
              ? 'Conta como gasto seu em cada mês da compra; o dinheiro só sai da conta quando você pagar a pessoa.'
              : 'Não conta como gasto (foi dinheiro que você pegou); só entra no que você precisa pagar.'}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input className="input" list="debt-people" placeholder="Com quem (pessoa)" value={person} onChange={(e) => setPerson(e.target.value)} />
            <datalist id="debt-people">
              {people.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <input className="input" placeholder="O que foi (ex: celular, empréstimo)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <input className="input" inputMode="decimal" placeholder="Valor total 0,00" value={total} onChange={(e) => setTotal(e.target.value)} />
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
              Parcelas
              <input className="input w-20 py-1.5 text-sm" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} title="Em quantas parcelas mensais" />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
              {kind === 'purchase' ? 'Primeira parcela em' : 'Começa a pagar em'}
              <input type="month" className="input w-36 py-1 text-[11px]" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            {kind === 'purchase' && (
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Categoria…</option>
                <CategoryOptions />
              </select>
            )}
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <button className="btn-primary w-full py-1.5" disabled={busy}>
            {busy ? 'Salvando…' : 'Registrar'}
          </button>
        </form>
      )}

      {groups.length === 0 ? (
        <p className="text-xs text-slate-500">Você não deve nada a ninguém agora. 🎉</p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.name} className="rounded-lg border border-slate-800 p-2.5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-200">{g.name}</span>
                <span className="flex flex-wrap items-center gap-2">
                  {offers.get(g.name) ? (
                    <button
                      className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25"
                      onClick={() => onSettle(g.name)}
                      title="Essa pessoa também te deve: dá pra descontar um valor do outro"
                    >
                      abater {formatBRL(offers.get(g.name)!)}
                    </button>
                  ) : null}
                  {g.owed > 0 && <span className="text-sm tabular-nums text-rose-300">devo {formatBRL(g.owed)}</span>}
                </span>
              </div>
              {(g.now.length > 0 || (showPaid && g.done.length > 0)) && (
                <ul className="divide-y divide-slate-800/70">
                  {[...g.now, ...(showPaid ? g.done : [])].map((d) => {
                    const late = !d.paid && keyOf(d.year, d.month) < viewKey
                    return (
                      <li key={d.id} className="flex items-center gap-2 py-1.5 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 accent-emerald-500"
                          checked={d.paid}
                          onChange={(e) => void onSetPaid(d, e.target.checked, accountId || null)}
                          title={d.paid ? 'Já paguei (desmarcar devolve o valor à conta)' : 'Marcar que paguei'}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={`break-words ${d.paid ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                            {d.description}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            <span className={late ? 'text-rose-400' : ''}>
                              {MONTHS_SHORT[d.month - 1]}/{d.year}
                              {late ? ' · atrasada' : ''}
                            </span>
                            {d.paid && d.paid_on ? ` · pago em ${formatDate(d.paid_on)}` : ''}
                            {d.paid && d.account_id
                              ? ` · saiu de ${accounts.find((a) => a.id === d.account_id)?.name ?? 'conta'}`
                              : ''}
                            {d.transaction_id ? ' · compra no cartão da pessoa' : ''}
                          </p>
                        </div>
                        <span className={`shrink-0 tabular-nums ${d.paid ? 'text-slate-500' : 'text-slate-200'}`}>
                          {formatBRL(Number(d.amount))}
                        </span>
                        <button
                          className="btn-danger shrink-0 px-1.5 py-0.5 text-[11px]"
                          onClick={() => void onRemove(d)}
                          title="Apagar esta parcela"
                        >
                          ✕
                        </button>
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

      {settlements.length > 0 && (
        <div className="mt-3 border-t border-slate-800 pt-2">
          <p className="mb-1 text-[11px] font-semibold text-slate-400">Abatimentos feitos</p>
          <ul className="space-y-0.5">
            {settlements.slice(0, 5).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>
                  {formatDate(s.settled_on)} · {s.person_name} · {formatBRL(Number(s.amount))}
                </span>
                <button className="text-emerald-400 hover:underline" onClick={() => void onUndoSettle(s)}>
                  desfazer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
