import { useState, type FormEvent } from 'react'
import type { SavingsAccount } from '../types'
import type { IncomeItem } from '../lib/incomes'
import { formatBRL, formatDate, parseAmount } from '../lib/format'

export interface IncomeEditValues {
  description: string
  amount: number
  day: number | null
  accountId: string | null
  receivedOn: string | null
}

interface Props {
  items: IncomeItem[]
  accounts: SavingsAccount[]
  onReceive: (item: IncomeItem, amount: number, accountId: string | null) => Promise<void>
  onUnreceive: (item: IncomeItem) => Promise<void>
  /** Não vai cair neste mês (receita fixa). */
  onSkip: (item: IncomeItem) => Promise<void>
  onRemove: (item: IncomeItem) => Promise<void>
  /** Apaga a receita fixa de vez (todos os meses). */
  onDeleteTemplate: (item: IncomeItem) => Promise<void>
  /** scope "month" muda só este mês; "all" muda a receita fixa (todos os meses). */
  onEdit: (item: IncomeItem, values: IncomeEditValues, scope: 'month' | 'all') => Promise<void>
  onAdd: (
    description: string,
    amount: number,
    opts: { received: boolean; accountId: string | null; day: number | null; repeat: boolean },
  ) => Promise<void>
}

/** Receitas do mês: a receber (previstas) e recebidas. Receber soma no saldo da conta escolhida. */
export default function IncomesBlock({
  items,
  accounts,
  onReceive,
  onUnreceive,
  onSkip,
  onRemove,
  onDeleteTemplate,
  onEdit,
  onAdd,
}: Props) {
  const contas = accounts.filter((a) => a.kind === 'conta')
  const accountName = (id: string | null) => contas.find((a) => a.id === id)?.name
  const total = items.reduce((s, i) => s + i.amount, 0)
  const received = items.filter((i) => i.received).reduce((s, i) => s + i.amount, 0)
  const pendingCount = items.filter((i) => !i.received).length

  const [open, setOpen] = useState(pendingCount > 0)
  const [busy, setBusy] = useState(false)
  // qual linha está com o painel de "receber", "editar" ou "remover" aberto
  const [receiving, setReceiving] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const [recAmount, setRecAmount] = useState('')
  const [recAccount, setRecAccount] = useState('')

  const [eDesc, setEDesc] = useState('')
  const [eAmount, setEAmount] = useState('')
  const [eDay, setEDay] = useState('')
  const [eAccount, setEAccount] = useState('')
  const [eDate, setEDate] = useState('')
  const [eScope, setEScope] = useState<'month' | 'all'>('month')

  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('')
  const [account, setAccount] = useState('')
  const [alreadyReceived, setAlreadyReceived] = useState(false)
  const [repeat, setRepeat] = useState(false)

  function closePanels() {
    setReceiving(null)
    setEditing(null)
    setRemoving(null)
  }

  function startReceive(item: IncomeItem) {
    closePanels()
    setReceiving(item.key)
    setRecAmount(item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
    setRecAccount(item.accountId ?? contas[0]?.id ?? '')
  }

  function startEdit(item: IncomeItem) {
    closePanels()
    setEditing(item.key)
    setEDesc(item.description)
    setEAmount(item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
    setEDay(item.day ? String(item.day) : '')
    setEAccount(item.accountId ?? '')
    setEDate(item.receivedOn ?? '')
    setEScope('month')
  }

  async function confirmReceive(item: IncomeItem) {
    const v = parseAmount(recAmount)
    if (v < 0) return
    setBusy(true)
    await onReceive(item, v, recAccount || null)
    closePanels()
    setBusy(false)
  }

  async function saveEdit(item: IncomeItem) {
    const v = parseAmount(eAmount)
    if (!eDesc.trim() || v < 0) return
    const d = Math.floor(Number(eDay))
    setBusy(true)
    await onEdit(
      item,
      {
        description: eDesc.trim(),
        amount: v,
        day: d >= 1 && d <= 31 ? d : null,
        accountId: eAccount || null,
        receivedOn: item.received ? eDate || null : null,
      },
      item.templateId ? eScope : 'month',
    )
    closePanels()
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
              {items.map((it) => {
                const skipped = it.received && it.amount === 0 && it.templateId != null
                return (
                  <li key={it.key} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span title={it.received ? 'Recebida' : 'A receber'}>
                        {skipped ? '⏭️' : it.received ? '✅' : '🕓'}
                      </span>
                      <span className="min-w-0 flex-1 text-slate-200">
                        {it.description}
                        <span className="ml-1.5 text-[11px] text-slate-500">
                          {skipped ? 'pulada neste mês' : it.day ? `dia ${it.day}` : ''}
                          {accountName(it.accountId) ? ` · ${accountName(it.accountId)}` : ''}
                          {it.templateId ? ' · fixa' : ''}
                          {it.received && it.receivedOn && !skipped
                            ? ` · recebida em ${formatDate(it.receivedOn)}`
                            : ''}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 tabular-nums ${it.received ? 'text-emerald-300' : 'text-slate-300'}`}
                      >
                        {skipped ? '—' : formatBRL(it.amount)}
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
                            onClick={() => (receiving === it.key ? closePanels() : startReceive(it))}
                          >
                            Receber
                          </button>
                          {it.templateId != null && (
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
                      {!skipped && (
                        <button
                          className="btn-ghost shrink-0 px-2 py-0.5 text-[11px]"
                          onClick={() => (editing === it.key ? closePanels() : startEdit(it))}
                          title="Editar"
                        >
                          editar
                        </button>
                      )}
                      <button
                        className="btn-danger shrink-0 px-2 py-0.5 text-xs"
                        onClick={() => {
                          if (it.templateId) {
                            closePanels()
                            setRemoving(removing === it.key ? null : it.key)
                          } else void onRemove(it)
                        }}
                        title="Remover"
                      >
                        ✕
                      </button>
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

                    {editing === it.key && (
                      <div className="mt-2 space-y-2 rounded-lg bg-slate-800/50 p-2">
                        <div className="grid grid-cols-[1fr_7rem] gap-2 sm:grid-cols-[1fr_8rem_5rem]">
                          <input
                            className="input col-span-2 sm:col-span-1"
                            value={eDesc}
                            onChange={(e) => setEDesc(e.target.value)}
                            placeholder="Descrição"
                            aria-label="Descrição da receita"
                          />
                          <input
                            className="input"
                            inputMode="decimal"
                            value={eAmount}
                            onChange={(e) => setEAmount(e.target.value)}
                            aria-label="Valor da receita"
                          />
                          <input
                            type="number"
                            min={1}
                            max={31}
                            className="input"
                            placeholder="Dia"
                            value={eDay}
                            onChange={(e) => setEDay(e.target.value)}
                            aria-label="Dia da receita"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {contas.length > 0 && (
                            <select
                              className="input w-auto py-1 text-xs"
                              value={eAccount}
                              onChange={(e) => setEAccount(e.target.value)}
                            >
                              <option value="">Sem conta</option>
                              {contas.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {it.received && (
                            <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                              recebida em
                              <input
                                type="date"
                                className="input py-1 text-xs"
                                value={eDate}
                                onChange={(e) => setEDate(e.target.value)}
                              />
                            </label>
                          )}
                        </div>
                        {it.templateId != null && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                            <span className="text-slate-400">Aplicar em:</span>
                            <label className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                className="accent-emerald-500"
                                checked={eScope === 'month'}
                                onChange={() => setEScope('month')}
                              />
                              só neste mês
                            </label>
                            <label className="flex items-center gap-1.5">
                              <input
                                type="radio"
                                className="accent-emerald-500"
                                checked={eScope === 'all'}
                                onChange={() => setEScope('all')}
                              />
                              todos os meses (receita fixa)
                            </label>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            className="btn-primary px-3 py-1 text-xs"
                            disabled={busy}
                            onClick={() => void saveEdit(it)}
                          >
                            Salvar
                          </button>
                          <button className="btn-ghost px-3 py-1 text-xs" onClick={closePanels}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {removing === it.key && (
                      <div className="mt-2 rounded-lg border border-rose-900/60 bg-rose-950/20 p-2 text-xs text-slate-300">
                        <p className="mb-2">
                          "{it.description}" é uma receita fixa. O que você quer remover?
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="btn-ghost px-2.5 py-1 text-xs"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true)
                              await onSkip(it)
                              closePanels()
                              setBusy(false)
                            }}
                          >
                            Só neste mês
                          </button>
                          <button
                            className="btn-danger px-2.5 py-1 text-xs"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true)
                              await onDeleteTemplate(it)
                              closePanels()
                              setBusy(false)
                            }}
                          >
                            Excluir a receita fixa (todos os meses)
                          </button>
                          <button className="btn-ghost px-2.5 py-1 text-xs" onClick={closePanels}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
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
