import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CATEGORIES, METHOD_LABEL, type PaymentMethod } from '../types'
import { MONTHS, MONTHS_SHORT, formatBRL, parseAmount } from '../lib/format'

interface Props {
  year: number
  knownBanks: string[]
  onClose: () => void
  onAdd: (p: {
    description: string
    count: number
    amount: number
    startYear: number
    startMonth: number
    day: number
    method?: PaymentMethod | null
    category?: string | null
    bank?: string | null
  }) => Promise<{ addedThisYear: number; addedNextYears: number }>
}

const METHOD_OPTIONS = Object.entries(METHOD_LABEL) as [PaymentMethod, string][]

export default function InstallmentModal({ year, knownBanks, onClose, onAdd }: Props) {
  const now = new Date()
  const [description, setDescription] = useState('')
  const [count, setCount] = useState(12)
  const [amountText, setAmountText] = useState('')
  const [startMonth, setStartMonth] = useState(now.getFullYear() === year ? now.getMonth() + 1 : 1)
  const [startYear, setStartYear] = useState(year)
  const [day, setDay] = useState(10)
  const [method, setMethod] = useState<PaymentMethod | ''>('cartao')
  const [category, setCategory] = useState('')
  const [bank, setBank] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = parseAmount(amountText)

  const range = useMemo(() => {
    const startOffset = startMonth - 1
    const endOffset = startOffset + Math.max(1, count) - 1
    const endYear = startYear + Math.floor(endOffset / 12)
    const endMonth = (endOffset % 12) + 1
    return {
      from: `${MONTHS_SHORT[startMonth - 1]}/${startYear}`,
      to: `${MONTHS_SHORT[endMonth - 1]}/${endYear}`,
    }
  }, [startMonth, startYear, count])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!description.trim()) return setError('Dê um nome para a compra.')
    if (count < 1 || count > 120) return setError('Número de parcelas inválido (1 a 120).')
    if (amount <= 0) return setError('Informe o valor da parcela.')

    setBusy(true)
    try {
      const res = await onAdd({
        description: description.trim(),
        count,
        amount,
        startYear,
        startMonth,
        day,
        method: method || null,
        category: category || null,
        bank: bank.trim() || null,
      })
      onClose()
      // feedback simples
      const extra = res.addedNextYears > 0 ? ` (${res.addedNextYears} em anos seguintes)` : ''
      queueMicrotask(() =>
        alert(`${count} parcelas adicionadas${extra}.`),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui salvar as parcelas.')
    } finally {
      setBusy(false)
    }
  }

  const years = Array.from({ length: 6 }, (_, i) => year - 2 + i)

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Adicionar parcelamento</h2>
            <p className="text-xs text-slate-400">
              Cria uma conta a pagar em cada mês (com vencimento), começando no mês escolhido.
            </p>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Descrição</label>
            <input
              className="input"
              placeholder="Ex: Notebook, Geladeira, Passagem…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Parcelas</label>
              <input
                type="number"
                min={1}
                max={120}
                className="input"
                value={count}
                onChange={(e) => setCount(Math.floor(Number(e.target.value) || 0))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Valor da parcela</label>
              <input
                className="input"
                inputMode="decimal"
                placeholder="0,00"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-400">A partir de</label>
              <div className="flex gap-2">
                <select
                  className="input"
                  value={startMonth}
                  onChange={(e) => setStartMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  className="input w-24"
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Dia venc.</label>
              <input
                type="number"
                min={1}
                max={31}
                className="input"
                value={day}
                onChange={(e) => setDay(Math.floor(Number(e.target.value) || 1))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Forma de pagamento</label>
              <select
                className="input"
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}
              >
                <option value="">Não especificar</option>
                {METHOD_OPTIONS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Categoria</label>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Sem categoria</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Banco</label>
              <input
                className="input"
                placeholder="Ex: Nubank…"
                list="banks-installment"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              />
              <datalist id="banks-installment">
                {knownBanks.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="rounded-xl bg-slate-800/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Total</span>
              <span className="font-semibold tabular-nums">
                {formatBRL(amount * Math.max(0, count))}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-500">
              <span>
                {count}x de {formatBRL(amount)}
              </span>
              <span>
                {range.from} → {range.to}
              </span>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Salvando…' : `Adicionar ${count} parcelas`}
          </button>
        </form>
      </div>
    </div>
  )
}
