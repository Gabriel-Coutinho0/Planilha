import { useEffect, useState, type FormEvent } from 'react'

interface Props {
  onClose: () => void
  onAdd: (text: string) => Promise<void>
}

export default function NoticeModal({ onClose, onAdd }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v = text.trim()
    if (!v) return
    setBusy(true)
    await onAdd(v)
    setBusy(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md rounded-b-none p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">Novo aviso</h2>
            <p className="text-xs text-slate-400">Um lembrete rápido, ex: "cartão fecha dia 20".</p>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>
            Fechar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            className="input w-full resize-y"
            rows={3}
            placeholder="Ex: cartão fecha dia 20, vence dia 28…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Salvando…' : 'Adicionar aviso'}
          </button>
        </form>
      </div>
    </div>
  )
}
