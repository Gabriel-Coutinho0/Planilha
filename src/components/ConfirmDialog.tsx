import { useEffect } from 'react'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, onConfirm])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-slate-100">{title}</h2>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
        <div className="mt-5 flex gap-2">
          <button className="btn-ghost flex-1" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              danger
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
