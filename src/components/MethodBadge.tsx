import { METHOD_LABEL, type PaymentMethod } from '../types'

const STYLE: Record<PaymentMethod, string> = {
  boleto: 'bg-amber-500/15 text-amber-300',
  cartao: 'bg-violet-500/15 text-violet-300',
  pix: 'bg-teal-500/15 text-teal-300',
  dinheiro: 'bg-slate-500/20 text-slate-300',
  outro: 'bg-slate-500/20 text-slate-300',
}

export default function MethodBadge({ method }: { method: PaymentMethod | null }) {
  if (!method) return null
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STYLE[method]}`}>
      {METHOD_LABEL[method]}
    </span>
  )
}
