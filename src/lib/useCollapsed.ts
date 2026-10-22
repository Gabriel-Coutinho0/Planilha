import { useState } from 'react'

/** Aberto/fechado de uma seção; a escolha da pessoa fica guardada, e sem escolha vale `defaultOpen`. */
export function useCollapsed(key: string, defaultOpen: boolean): [boolean, () => void] {
  const [choice, setChoice] = useState<boolean | null>(() => {
    try {
      const v = localStorage.getItem(key)
      return v === 'open' ? true : v === 'closed' ? false : null
    } catch {
      return null
    }
  })
  const open = choice ?? defaultOpen
  function toggle() {
    const next = !open
    setChoice(next)
    try {
      localStorage.setItem(key, next ? 'open' : 'closed')
    } catch {
      // sem armazenamento: só vale nesta sessão
    }
  }
  return [open, toggle]
}
