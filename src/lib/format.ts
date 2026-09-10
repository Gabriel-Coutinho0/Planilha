const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatBRL(value: number): string {
  return brl.format(Number.isFinite(value) ? value : 0)
}

/** Le "1.234,56" ou "1234.56" ou "R$ 1.234,56" e devolve numero. */
export function parseAmount(input: string): number {
  if (!input) return 0
  const cleaned = input.replace(/[^\d,.-]/g, '').trim()
  if (!cleaned) return 0
  // Se tem virgula, assume formato pt-BR (ponto = milhar, virgula = decimal)
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const n = parseFloat(normalized)
  return Number.isFinite(n) ? n : 0
}

export const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

export const MONTHS_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]
