import { useEffect, useState } from 'react'
import { parseAmount } from '../lib/format'

interface Props {
  value: number
  onCommit: (value: number) => void
  className?: string
  placeholder?: string
  ariaLabel?: string
}

/** Campo de texto que aceita "1.234,56" e entrega numero no blur / Enter. */
export default function MoneyInput({ value, onCommit, className, placeholder, ariaLabel }: Props) {
  const [text, setText] = useState(format(value))

  useEffect(() => {
    setText(format(value))
  }, [value])

  function commit() {
    const n = parseAmount(text)
    setText(format(n))
    if (n !== value) onCommit(n)
  }

  return (
    <div className={`flex items-center rounded-lg border border-slate-700 bg-slate-950/60 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/30 ${className ?? ''}`}>
      <span className="pl-2.5 text-xs text-slate-500">R$</span>
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        className="w-full bg-transparent px-2 py-2 text-right text-sm outline-none"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </div>
  )
}

function format(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
