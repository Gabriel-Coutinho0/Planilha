import { useState, type FormEvent } from 'react'
import type { CategoryRule, PaymentMethod } from '../types'
import { METHOD_LABEL } from '../types'
import type { RuleInput } from '../lib/useRules'
import CategoryOptions from './CategoryOptions'

const METHOD_OPTIONS = Object.entries(METHOD_LABEL) as [PaymentMethod, string][]

interface Props {
  rules: CategoryRule[]
  knownBanks: string[]
  onSave: (r: RuleInput) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export default function RulesPanel({ rules, knownBanks, onSave, onRemove }: Props) {
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')
  const [method, setMethod] = useState<PaymentMethod | ''>('')
  const [bank, setBank] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!keyword.trim() || (!category && !method && !bank.trim())) return
    setBusy(true)
    await onSave({
      keyword,
      category: category || null,
      method: method || null,
      bank: bank.trim() || null,
    })
    setKeyword('')
    setCategory('')
    setMethod('')
    setBank('')
    setBusy(false)
  }

  return (
    <div className="card p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-300">Regras automáticas</h3>
        <p className="text-[11px] text-slate-500">
          Quando a descrição de um lançamento contém a palavra-chave, categoria, forma e banco já vêm
          preenchidos (só nos campos que você ainda não escolheu).
        </p>
      </div>

      <ul className="mb-3 divide-y divide-slate-800">
        {rules.length === 0 && (
          <li className="py-3 text-xs text-slate-500">
            Nenhuma regra ainda. Ex.: "uber" → Transporte, "ifood" → Alimentação.
          </li>
        )}
        {rules.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-200">
              {r.keyword}
            </span>
            <span className="text-slate-500">→</span>
            <span className="min-w-0 flex-1 text-xs text-slate-300">
              {[r.category, r.method ? METHOD_LABEL[r.method] : null, r.bank].filter(Boolean).join(' · ')}
            </span>
            <button
              className="btn-danger shrink-0 px-2 py-0.5 text-xs"
              onClick={() => void onRemove(r.id)}
              title="Remover regra"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          className="input basis-full sm:w-40 sm:basis-auto"
          placeholder="Palavra-chave (ex: uber)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <select
          className="input w-full basis-full sm:w-36 sm:basis-auto"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Categoria…</option>
          <CategoryOptions />
        </select>
        <select
          className="input w-full basis-full sm:w-28 sm:basis-auto"
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}
        >
          <option value="">Forma…</option>
          {METHOD_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="input w-full basis-full sm:w-32 sm:basis-auto"
          placeholder="Banco…"
          list="rules-banks"
          value={bank}
          onChange={(e) => setBank(e.target.value)}
        />
        <datalist id="rules-banks">
          {knownBanks.map((b) => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <button className="btn-primary shrink-0" disabled={busy}>
          Adicionar regra
        </button>
      </form>
    </div>
  )
}
