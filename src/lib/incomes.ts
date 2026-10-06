import type { ExtraIncome, IncomeTemplate } from '../types'

/** Se uma receita fixa está ativa e já começou a valer num mês/ano. */
export function templateAppliesToMonth(t: IncomeTemplate, year: number, month: number): boolean {
  if (!t.active) return false
  if (t.start_year != null && t.start_month != null) {
    if (year < t.start_year || (year === t.start_year && month < t.start_month)) return false
  }
  return true
}

/** Um item de receita de um mês: já lançado (linha no banco) ou ainda só previsto (receita fixa sem linha). */
export interface IncomeItem {
  key: string
  /** Id da linha no banco; null = previsto da receita fixa, ainda sem lançamento. */
  id: string | null
  templateId: string | null
  description: string
  amount: number
  day: number | null
  accountId: string | null
  received: boolean
}

export function monthIncomeItems(
  templates: IncomeTemplate[],
  rows: ExtraIncome[],
  year: number,
  month: number,
): IncomeItem[] {
  const monthRows = rows.filter((r) => r.year === year && r.month === month)
  const items: IncomeItem[] = monthRows.map((r) => ({
    key: r.id,
    id: r.id,
    templateId: r.template_id,
    description: r.description,
    amount: Number(r.amount),
    day: r.day,
    accountId: r.account_id,
    received: r.received,
  }))
  // receita fixa que ainda não virou linha neste mês = a receber (previsto)
  for (const t of templates) {
    if (!templateAppliesToMonth(t, year, month)) continue
    if (monthRows.some((r) => r.template_id === t.id)) continue
    items.push({
      key: `tpl-${t.id}`,
      id: null,
      templateId: t.id,
      description: t.name,
      amount: Number(t.amount),
      day: t.day,
      accountId: t.account_id,
      received: false,
    })
  }
  return items.sort((a, b) => (a.day ?? 99) - (b.day ?? 99))
}
