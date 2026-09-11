import { CATEGORY_COLOR } from '../types'

export default function CategoryTag({ category }: { category: string | null }) {
  if (!category) return null
  const color = CATEGORY_COLOR[category] ?? CATEGORY_COLOR['Outro']
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {category}
    </span>
  )
}
