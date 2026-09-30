import { useState, type FormEvent } from 'react'
import type { Notice } from '../types'
import { formatDate } from '../lib/format'

interface Props {
  notices: Notice[]
  onAdd: (text: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
}

export default function NoticesCard({ notices, onAdd, onRemove }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    setBusy(true)
    await onAdd(v)
    setText('')
    setBusy(false)
  }

  return (
    <div className="card p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Avisos</p>

      {notices.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">Nenhum aviso por aqui.</p>
      ) : (
        <ul className="mb-3 divide-y divide-slate-800">
          {notices.map((n) => (
            <li key={n.id} className="flex items-start gap-2 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="break-words text-slate-200">{n.text}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{formatDate(n.created_at)}</p>
              </div>
              <button
                className="btn-danger shrink-0 px-2 py-1 text-xs"
                onClick={() => void onRemove(n.id)}
                title="Remover aviso"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
        <input
          className="input basis-full sm:flex-1"
          placeholder="Ex: cartão fecha dia 20, vence dia 28…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={busy}>
          Adicionar
        </button>
      </form>
    </div>
  )
}
