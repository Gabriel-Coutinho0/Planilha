import { useState } from 'react'
import { createPortal } from 'react-dom'
import { formatBRL } from '../lib/format'

interface Props {
  person: string
  /** Quanto a pessoa me deve (total em aberto). */
  mine: number
  /** Quanto eu devo a ela (total em aberto). */
  theirs: number
  /** Valor que será abatido dos dois lados. */
  amount: number
  onConfirm: () => Promise<void>
  onClose: () => void
}

/** Confirmação do encontro de contas com uma pessoa. */
export default function SettleModal({ person, mine, theirs, amount, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false)
  const left = Math.round((mine - theirs) * 100) / 100
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
        <h4 className="text-sm font-semibold">Abater com {person}</h4>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">{person} me deve</dt>
            <dd className="tabular-nums text-emerald-300">{formatBRL(mine)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Eu devo a {person}</dt>
            <dd className="tabular-nums text-rose-300">{formatBRL(theirs)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-800 pt-1 font-semibold">
            <dt>Abatimento</dt>
            <dd className="tabular-nums">{formatBRL(amount)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-[11px] text-slate-500">
          As parcelas mais antigas dos dois lados são quitadas, sem mexer em nenhuma conta.{' '}
          {left > 0
            ? `${person} ainda te deve ${formatBRL(left)}.`
            : left < 0
              ? `Você ainda deve ${formatBRL(-left)} a ${person}.`
              : 'Os dois lados ficam zerados.'}{' '}
          Dá para desfazer depois.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            className="btn-primary flex-1 py-1.5"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } finally {
                setBusy(false)
                onClose()
              }
            }}
          >
            {busy ? 'Abatendo…' : 'Abater'}
          </button>
          <button className="btn-ghost px-3 py-1.5" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
