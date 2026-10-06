import { useCategories } from '../lib/categories'

/** `<option>` de todas as categorias cadastradas (pra usar dentro de um `<select>`). */
export default function CategoryOptions() {
  const { names } = useCategories()
  return (
    <>
      {names.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </>
  )
}
