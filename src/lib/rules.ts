import type { CategoryRule } from '../types'

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Regra que casa com a descrição (a de palavra-chave mais longa, se houver várias). */
export function matchRule(rules: CategoryRule[], description: string): CategoryRule | null {
  const d = norm(description)
  if (d.length < 2) return null
  let best: CategoryRule | null = null
  for (const r of rules) {
    const k = norm(r.keyword)
    if (k && d.includes(k) && (!best || k.length > norm(best.keyword).length)) best = r
  }
  return best
}

/** Palavra-chave sugerida a partir de uma descrição: a primeira palavra com 3+ letras. */
export function suggestKeyword(description: string): string {
  const words = norm(description).split(/[^a-z0-9]+/).filter(Boolean)
  return words.find((w) => w.length >= 3) ?? words[0] ?? ''
}
