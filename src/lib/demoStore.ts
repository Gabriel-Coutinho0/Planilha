import type { FixedExpense, MonthlySalary, Transaction } from '../types'

/** Store em memória para o modo demonstração. Zera ao recarregar a página. */
const uid = () => Math.random().toString(36).slice(2)
const YEAR = new Date().getFullYear()

export const demoStore = {
  defaultSalary: 3900,
  fixedExpenses: [
    mkFixed('Aluguel', 1500),
    mkFixed('Academia', 120),
    mkFixed('Internet', 100),
    mkFixed('Streaming', 55),
  ] as FixedExpense[],
  salaries: [
    { id: uid(), user_id: 'demo', year: YEAR, month: 12, salary: 5800 },
  ] as MonthlySalary[],
  transactions: seedTx(),
}

function mkFixed(name: string, amount: number): FixedExpense {
  return { id: uid(), user_id: 'demo', name, amount, active: true, created_at: new Date().toISOString() }
}

function seedTx(): Transaction[] {
  const rows: Array<[number, string, number, number]> = [
    [new Date().getMonth() + 1, 'Mercado', 640, 5],
    [new Date().getMonth() + 1, 'Uber', 90, 8],
    [new Date().getMonth() + 1, 'Farmácia', 130, 12],
    [Math.max(1, new Date().getMonth()), 'Presente', 250, 20],
    [Math.max(1, new Date().getMonth()), 'Restaurante', 180, 22],
  ]
  return rows.map(([month, description, amount, day]) => ({
    id: uid(),
    user_id: 'demo',
    year: YEAR,
    month,
    description,
    amount,
    occurred_on: `${YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    created_at: new Date().toISOString(),
  }))
}

export { uid as demoId }
