interface Props {
  message: string
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
}

export default function Toast({ message, actionLabel, onAction, onClose }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm shadow-xl shadow-black/40">
        <span className="text-slate-200">{message}</span>
        {actionLabel && onAction && (
          <button
            className="font-semibold text-emerald-400 hover:text-emerald-300"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        )}
        <button className="text-slate-500 hover:text-slate-300" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>
    </div>
  )
}
