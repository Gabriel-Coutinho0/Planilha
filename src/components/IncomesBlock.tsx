import { useState, type FormEvent } from 'react'
import type { SavingsAccount } from '../types'
import type { IncomeItem } from '../lib/incomes'
import { formatBRL, parseAmount } from '../lib/format'

interface Props {
  items: IncomeItem[]
  accounts: SavingsAccount[]
  onReceive: (item: IncomeItem, amount: number, accountId: string | null) => Promise<void>
  onUnreceive: (item: IncomeItem) => Promise<void>
  onSkip: (item: IncomeItem) => Promise<void>
  onRemove: (item: IncomeItem) => Promise<void>
  onAdd: (
    description: string,
    amount: number,
    opts: { received: boolean; accountId: string | null; day: number | null; repeat: boolean },
  ) => Promise<void>
}

/** Receitas do mês: a receber (previstas) e recebidas. Receber soma no saldo da conta escolhida. */
export default function IncomesBlock({ items, accounts, onReceive, onUnreceive, onSkip, onRemove, onAdd }: Props) {
  const contas = accounts.filter((a) => a.kind === 'conta')
  const accountName = (id: string | null) => contas.find((a) => a.id === id)?.name
  const total = items.reduce((s, i) => s + i.amount, 0)
  const received = items.filter((i) => i.received).reduce((s, i) => s + i.amount, 0)
  const pendingCount = items.filter((i) => !i.received).length

  const [open, setOpen] = useState(pendingCount > 0)
  const [receiving, setReceiving] = useState<string | null>(null)
  const [recAmount, setRecAmount] = useState('')
  const [recAccount, setRecAccount] = useState('')
  const [busy, setBusy] = useState(false)

  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('')
  const [account, setAccount] = useState('')
  const [alreadyReceived, setAlreadyReceived] = useState(false)
  const [repeat, setRepeat] = useState(false)

  function startReceive(item: IncomeItem) {
    setReceiving(item.key)
    setRecAmount(item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
    setRecAccount(item.accountId ?? contas[0]?.id ?? '')
  }

  async function confirmReceive(item: IncomeItem) {
    const v = parseAmount(recAmount)
    if (v < 0) return
    setBusy(true)
    await onReceive(item, v, recAccount || null)
    setReceiving(null)
    setBusy(false)
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const v = parseAmount(amount)
    if (v <= 0) return
    setBusy(true)
    const d = Math.floor(Number(day))
    await onAdd(desc.trim() || 'Receita', v, {
      received: alreadyReceived,
      accountId: account || null,
      day: d >= 1 && d <= 31 ? d : null,
      repeat,
    })
    setDesc('')
    setAmount('')
    setDay('')
    setAlreadyReceived(false)
    setRepeat(false)
    setBusy(false)
  }

  return (
    <div className="mb-4 rounded-xl bg-slate-800/30 p-3">
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-x-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="text-sm font-semibold text-slate-300">Receitas do mês {open ? '▾' : '▸'}</h3>
        <span className="text-xs font-semibold tabular-nums text-emerald-300">
          {items.length > 0
            ? `recebido ${formatBRL(received)} de ${formatBRL(total)}`
            : 'adicionar salário, 13º, freela…'}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          {items.length > 0 && (
            <ul className="mb-3 divide-y divide-slate-800">
              {items.map((it) => (
                <li key={it.key} className="py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span title={it.received ? 'Recebida' : 'A receber'}>{it.received ? '✅' : '🕓'}</span>
                    <span className="min-w-0 flex-1 text-slate-200">
                      {it.description}
                      <span className="ml-1.5 text-[11px] text-slate-500">
                        {it.day ? `dia ${it.day}` : ''}
                        {accountName(it.accountId) ? ` · ${accountName(it.accountId)}` : ''}
                        {it.templateId ? ' · fixa' : ''}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 tabular-nums ${it.received ? 'text-emerald-300' : 'text-slate-300'}`}
                    >
                      {formatBRL(it.amount)}
                    </span>
                    {it.received ? (
                      <button
                        className="btn-ghost shrink-0 px-2 py-0.5 text-[11px]"
                        onClick={() => void onUnreceive(it)}
                      >
                        desfazer
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn-primary shrink-0 px-2.5 py-0.5 text-[11px]"
                          onClick={() => (receiving === it.key ? setReceiving(null) : startReceive(it))}
                        >
                          Receber
                        </button>
                        {it.id == null && (
                          <button
                            className="btn-ghost shrink-0 px-2 py-0.5 text-[11px]"
                            onClick={() => void onSkip(it)}
                            title="Não vai cair neste mês"
                          >
                            pular
                          </button>
                        )}
                      </>
                    )}
                    {it.id != null && !it.templateId && (
                      <button
                        className="btn-danger shrink-0 px-2 py-0.5 text-xs"
                        onClick={() => void onRemove(it)}
                        title="Remover"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {receiving === it.key && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-800/50 p-2">
                      <input
                        className="input w-28 py-1 text-right"
                        inputMode="decimal"
                        value={recAmount}
                        onChange={(e) => setRecAmount(e.target.value)}
                        aria-label="Valor recebido"
                      />
                      {contas.length > 0 && (
                        <select
                          className="input w-auto py-1 text-xs"
                          value={recAccount}
                          onChange={(e) => setRecAccount(e.target.value)}
                        >
                          <option value="">Não somar em nenhuma conta</option>
                          {contas.map((a) => (
                            <option key={a.id} value={a.id}>
                              Somar em {a.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        className="btn-primary px-3 py-1 text-xs"
                        disabled={busy}
                        onClick={() => void confirmReceive(it)}
                      >
                        Confirmar recebimento
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAdd} className="space-y-2 rounded-lg bg-slate-800/40 p-2">
            <div className="grid grid-cols-[1fr_7rem] gap-2 sm:grid-cols-[1fr_8rem_5rem]">
              <input
                className="input col-span-2 sm:col-span-1"
                placeholder="Descrição (ex: salário, presente, freela)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
              <input
                className="input"
                placeholder="Valor 0,00"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <input
                type="number"
                min={1}
                max={31}
                className="input"
                placeholder="Dia"
                title="Dia do mês em que deve cair"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {contas.length > 0 && (
                <select
                  className="input w-auto py-1 text-xs"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                >
                  <option value="">Conta de destino…</option>
                  {contas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-500"
                  checked={alreadyReceived}
                  onChange={(e) => setAlreadyReceived(e.target.checked)}
                />
                já recebida
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-300">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-500"
                  checked={repeat}
                  onChange={(e) => setRepeat(e.target.checked)}
                />
                repete todo mês (receita fixa)
              </label>
              <button className="btn-primary ml-auto px-3 py-1 text-xs" disabled={busy}>
                Adicionar
              </button>
            </div>
          </form>
          <p className="mt-1.5 text-[11px] text-slate-500">
            A receber não soma no saldo da conta. Ao confirmar o recebimento, o valor entra na conta escolhida.
          </p>
        </div>
      )}
    </div>
  )
}
