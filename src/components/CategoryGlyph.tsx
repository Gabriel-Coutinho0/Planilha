import { CATEGORY_ICONS } from '../lib/categoryIcons'
import { useCategories } from '../lib/categories'

/** Ícone colorido de uma categoria (pelo nome, ou direto por ícone + cor). */
export default function CategoryGlyph({
  category,
  icon,
  color,
  className = 'h-3.5 w-3.5',
}: {
  category?: string | null
  icon?: string
  color?: string
  className?: string
}) {
  const cats = useCategories()
  const Icon = CATEGORY_ICONS[icon ?? cats.iconOf(category)] ?? CATEGORY_ICONS.tag
  return <Icon className={`shrink-0 ${className}`} style={{ color: color ?? cats.colorOf(category) }} aria-hidden />
}
