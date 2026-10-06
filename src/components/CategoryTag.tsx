import CategoryGlyph from './CategoryGlyph'

export default function CategoryTag({ category }: { category: string | null }) {
  if (!category) return null
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
      <CategoryGlyph category={category} className="h-3 w-3" />
      {category}
    </span>
  )
}
