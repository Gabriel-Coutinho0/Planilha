import { useState } from 'react'

interface Props {
  note: string | null
  /** Se informado, o campo vira editável: clique abre um textarea e salva ao sair do foco. */
  onSave?: (value: string) => void
}

export default function NoteText({ note, onSave }: Props) {
  const [open, setOpen] = useState(false)

  if (!note && !onSave) return null

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3 w-3 shrink-0">
          <path
            d="M7.5 5.5l4.5 4.5-4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {note ? 'observação' : '+ observação'}
      </button>
    )
  }

  if (onSave) {
    return (
      <textarea
        className="input mt-1 w-full resize-y text-[11px]"
        rows={2}
        autoFocus
        defaultValue={note ?? ''}
        placeholder="Observação…"
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => {
          onSave(e.target.value.trim())
          setOpen(false)
        }}
      />
    )
  }

  return (
    <p
      onClick={(e) => {
        e.stopPropagation()
        setOpen(false)
      }}
      className="mt-1 cursor-pointer whitespace-pre-wrap break-words rounded-md bg-slate-800/60 p-2 text-[11px] text-slate-300"
    >
      {note}
    </p>
  )
}
