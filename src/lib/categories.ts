import { useMemo, useSyncExternalStore } from 'react'

export interface Category {
  id: string
  name: string
  color: string
  /** Chave do ícone em `categoryIcons` (ex.: "shopping-cart"). */
  icon: string
  position: number
}

/** Categorias que todo mundo começa tendo (o usuário pode renomear, trocar ícone/cor ou apagar). */
export const DEFAULT_CATEGORIES: Array<Pick<Category, 'name' | 'color' | 'icon'>> = [
  { name: 'Mercado', color: '#34d399', icon: 'shopping-cart' },
  { name: 'Alimentação', color: '#fb923c', icon: 'utensils' },
  { name: 'Transporte', color: '#60a5fa', icon: 'car' },
  { name: 'Moradia', color: '#f59e0b', icon: 'home' },
  { name: 'Saúde', color: '#f472b6', icon: 'heart-pulse' },
  { name: 'Lazer', color: '#a78bfa', icon: 'gamepad' },
  { name: 'Educação', color: '#22d3ee', icon: 'graduation-cap' },
  { name: 'Assinaturas', color: '#fb7185', icon: 'repeat' },
  { name: 'Roupas', color: '#c084fc', icon: 'shirt' },
  { name: 'Contas', color: '#facc15', icon: 'receipt' },
  { name: 'Dívidas', color: '#ef4444', icon: 'landmark' },
  { name: 'Presente', color: '#2dd4bf', icon: 'gift' },
  { name: 'Outro', color: '#94a3b8', icon: 'tag' },
]

export const defaultCategoryList = (): Category[] =>
  DEFAULT_CATEGORIES.map((c, i) => ({ id: `default:${c.name}`, position: i, ...c }))

/** Cores de categorias "automáticas" que não ficam no cadastro. */
const SYSTEM_COLOR: Record<string, string> = {
  'Sem categoria': '#64748b',
  Fixos: '#a3b2c7',
}
const FALLBACK_COLOR = '#94a3b8'

/** alpha = ordem alfabética ("Outro" sempre no fim); custom = a ordem que a pessoa montou (position). */
export type CategoryOrder = 'alpha' | 'custom'
const ORDER_KEY = 'cat-order'

function readOrder(): CategoryOrder {
  try {
    return localStorage.getItem(ORDER_KEY) === 'custom' ? 'custom' : 'alpha'
  } catch {
    return 'alpha'
  }
}

/** Ordem alfabética em português, com "Outro" no fim. */
export function sortAlpha(list: Category[]): Category[] {
  return [...list].sort((a, b) => {
    if (a.name === 'Outro') return 1
    if (b.name === 'Outro') return -1
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
  })
}

function sortBy(list: Category[], order: CategoryOrder): Category[] {
  return order === 'alpha' ? sortAlpha(list) : [...list].sort((a, b) => a.position - b.position)
}

// Store simples (fora do React) pra qualquer componente ler as categorias atuais sem receber props.
let state: { list: Category[]; version: number; order: CategoryOrder } = {
  list: sortBy(defaultCategoryList(), readOrder()),
  version: 0,
  order: readOrder(),
}
const listeners = new Set<() => void>()

/** `bump` avisa que algo foi renomeado/apagado: quem carrega dados por categoria deve recarregar. */
export function setCategories(list: Category[], bump = false) {
  state = { ...state, list: sortBy(list, state.order), version: state.version + (bump ? 1 : 0) }
  listeners.forEach((l) => l())
}

/** Troca a ordem das categorias em todo o app (fica guardada neste navegador). */
export function setCategoryOrder(order: CategoryOrder) {
  try {
    localStorage.setItem(ORDER_KEY, order)
  } catch {
    // sem armazenamento: vale só nesta sessão
  }
  state = { ...state, order, list: sortBy(state.list, order) }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function useCategories() {
  const s = useSyncExternalStore(subscribe, () => state)
  return useMemo(() => {
    const byName = new Map(s.list.map((c) => [c.name, c]))
    return {
      list: s.list,
      order: s.order,
      names: s.list.map((c) => c.name),
      version: s.version,
      colorOf: (name: string | null | undefined) =>
        (name && (byName.get(name)?.color ?? SYSTEM_COLOR[name])) ||
        byName.get('Outro')?.color ||
        FALLBACK_COLOR,
      iconOf: (name: string | null | undefined) => (name ? byName.get(name)?.icon : undefined) ?? 'tag',
    }
  }, [s])
}
