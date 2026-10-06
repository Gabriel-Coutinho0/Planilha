import { useEffect, useMemo, useState } from 'react'
import type { Card, CategoryRule, Transaction } from '../types'
import { formatBRL, formatDate } from '../lib/format'
import { cardDueDate, cardStatementMonth, closingLabel } from '../lib/cards'
import { matchRule } from '../lib/rules'
import { parseStatement, readFileText } from '../lib/statementParser'
import CategoryOptions from './CategoryOptions'

export type ImportRow = Omit<Transaction, 'id' | 'user_id' | 'created_at'>

interface Props {
  cards: Card[]
  rules: CategoryRule[]
  /** Lançamentos já cadastrados (pra avisar de possíveis duplicados). */
  existing: Transaction[]
  onClose: () => void
  onImport: (rows: ImportRow[]) => Promise<number>
  /** Chamado após importar, com o ano/mês onde os lançamentos entraram (mês da compra mais recente). */
  onDone: (count: number, year: number, month: number) => void
}

interface Line {
  key: number
  date: string
  description: string
  amount: number
  category: string
  selected: boolean
  isCredit: boolean
  duplicate: boolean
}

export default function ImportStatementModal({ cards, rules, existing, onClose, onImport, onDone }: Props) {
  const [cardId, setCardId] = useState(cards[0]?.id ?? '')
  const [fileName, setFileName] = useState('')
  const [lines, setLines] = useState<Line[] | null>(null)
  // vazio = automático: cada compra vai pra fatura certa pelo dia de fechamento do cartão
  const [dueOverride, setDueOverride] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const card = cards.find((c) => c.id === cardId) ?? null

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** Vencimento da fatura em que a compra cai: compra a partir do dia de fechamento vai pra seguinte. */
  const dueOf = (date: string) => dueOverride || (card ? cardDueDate(card, date) : '')

  async function pickFile(file: File) {
    setError(null)
    setLines(null)
    setFileName(file.name)
    try {
      const text = await readFileText(file)
      const { rows } = parseStatement(text, file.name)
      const seen = new Set(existing.map((t) => `${t.occurred_on.slice(0, 10)}|${Number(t.amount).toFixed(2)}`))
      setLines(
        rows.map((r, i) => {
          const rule = matchRule(rules, r.description)
          const duplicate = !r.isCredit && seen.has(`${r.date}|${r.amount.toFixed(2)}`)
          return {
            key: i,
            date: r.date,
            description: r.description,
            amount: r.amount,
            category: rule?.category ?? '',
            selected: !r.isCredit && !duplicate,
            isCredit: r.isCredit,
            duplicate,
          }
        }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui ler o arquivo.')
    }
  }

  function patch(key: number, p: Partial<Line>) {
    setLines((ls) => ls?.map((l) => (l.key === key ? { ...l, ...p } : l)) ?? null)
  }

  const chosen = useMemo(() => (lines ?? []).filter((l) => l.selected), [lines])
  const total = chosen.reduce((s, l) => s + l.amount, 0)
  // quantas compras marcadas caem em cada vencimento (pra mostrar no resumo)
  const dueSummary = useMemo(() => {
    const map = new Map<string, number>()
    for (const l of chosen) {
      const d = dueOverride || (card ? cardDueDate(card, l.date) : '')
      if (d) map.set(d, (map.get(d) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [chosen, dueOverride, card])
  const credits = (lines ?? []).filter((l) => l.isCredit).length
  const dups = (lines ?? []).filter((l) => l.duplicate).length

  async function submit() {
    if (!card || chosen.length === 0) return
    setBusy(true)
    setError(null)
    try {
      // cada lançamento fica no mês da fatura em que cai (pelo dia de fechamento do cartão)
      const latest = chosen.reduce((m, l) => (l.date > m ? l.date : m), chosen[0].date)
      const { year: targetYear, month: targetMonth } = cardStatementMonth(card, latest)
      const rows: ImportRow[] = chosen.map((l) => ({
        year: cardStatementMonth(card, l.date).year,
        month: cardStatementMonth(card, l.date).month,
        description: l.description,
        amount: l.amount,
        occurred_on: l.date,
        paid: false,
        paid_on: null,
        due_date: dueOf(l.date) || null,
        method: 'cartao',
        category: l.category || null,
        bank: card.bank || card.name,
        note: null,
        group_id: null,
        card_id: card.id,
        debit_account_id: null,
        recurring_id: null,
      }))
      const n = await onImport(rows)
      onDone(n, targetYear, targetMonth)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui importar.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">Importar fatura</h2>
            <p className="text-xs text-slate-400">
              Arquivo CSV ou OFX do banco. A leitura acontece no seu navegador: nada é enviado.
            </p>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Cartão</label>
            <select className="input" value={cardId} onChange={(e) => setCardId(e.target.value)}>
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Arquivo da fatura</label>
            <input
              type="file"
              accept=".csv,.ofx,.txt,text/csv"
              className="input file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:text-slate-100"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void pickFile(f)
              }}
            />
          </div>
        </div>

        {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

        {lines && (
          <>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>
                {lines.length} linhas em <span className="text-slate-300">{fileName}</span>
                {credits > 0 && ` · ${credits} pagamentos/estornos (desmarcados)`}
                {dups > 0 && ` · ${dups} já existem (desmarcados)`}
              </span>
              <label className="flex items-center gap-1.5">
                forçar vencimento
                <input
                  type="date"
                  className="input w-36 py-1 text-xs"
                  value={dueOverride}
                  onChange={(e) => setDueOverride(e.target.value)}
                />
                {dueOverride && (
                  <button className="text-slate-400 underline" onClick={() => setDueOverride('')}>
                    automático
                  </button>
                )}
              </label>
            </div>
            {card && (
              <p className="mb-2 text-[11px] text-slate-400">
                {dueOverride ? 'Vencimento forçado: ' : `Pelo fechamento do cartão (${closingLabel(card)}): `}
                {dueSummary.length === 0
                  ? '—'
                  : dueSummary
                      .map(([d, n]) => `${formatDate(d)} (${n} ${n === 1 ? 'compra' : 'compras'})`)
                      .join(' · ')}
              </p>
            )}

            <ul className="mb-3 max-h-[45vh] divide-y divide-slate-800 overflow-y-auto rounded-xl bg-slate-800/30 px-2">
              {lines.map((l) => (
                <li
                  key={l.key}
                  className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1 py-2 text-sm ${l.selected ? '' : 'opacity-60'}`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-500"
                    checked={l.selected}
                    onChange={(e) => patch(l.key, { selected: e.target.checked })}
                  />
                  <input
                    className="min-w-0 rounded bg-transparent px-1 py-0.5 outline-none focus:bg-slate-800"
                    value={l.description}
                    onChange={(e) => patch(l.key, { description: e.target.value })}
                  />
                  <span
                    className={`text-right tabular-nums ${l.amount < 0 ? 'text-emerald-300' : 'text-rose-300'}`}
                  >
                    {formatBRL(l.amount)}
                  </span>
                  <span />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                    <span>
                      {formatDate(l.date)}
                      {card && ` · vence ${formatDate(dueOf(l.date))}`}
                    </span>
                    <select
                      className="rounded bg-slate-800 px-1 py-0.5 text-[11px] text-slate-300"
                      value={l.category}
                      onChange={(e) => patch(l.key, { category: e.target.value })}
                    >
                      <option value="">Categoria…</option>
                      <CategoryOptions />
                    </select>
                    {l.duplicate && <span className="text-amber-300">possível duplicado</span>}
                    {l.isCredit && <span className="text-sky-300">pagamento/estorno</span>}
                  </div>
                  <span />
                </li>
              ))}
            </ul>

            <button
              className="btn-primary w-full"
              disabled={busy || chosen.length === 0 || !card}
              onClick={() => void submit()}
            >
              {busy
                ? 'Importando…'
                : `Importar ${chosen.length} lançamentos (${formatBRL(total)})`}
            </button>
            <p className="mt-2 text-[11px] text-slate-500">
              Cada lançamento entra no mês da fatura em que cai (pelo dia de fechamento do cartão
              {card ? `, ${closingLabel(card)}` : ''}), como "a pagar", ligado ao cartão {card?.name}. A data
              da compra é mantida. Categorias vêm das suas regras automáticas. Marcar um pagamento/estorno importa como valor negativo (abate o gasto).
            </p>
          </>
        )}

        {!lines && !error && (
          <p className="py-6 text-center text-xs text-slate-500">
            Nubank: Fatura → Exportar (CSV). Outros bancos: procure "exportar fatura" em CSV ou OFX.
          </p>
        )}
      </div>
    </div>
  )
}
