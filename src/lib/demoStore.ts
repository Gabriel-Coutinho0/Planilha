import type { FixedExpense, FixedExpenseStatus, MonthlySalary, Transaction } from '../types'

/** Store em memória para o modo demonstração. Zera ao recarregar a página. */
const uid = () => Math.random().toString(36).slice(2)
const YEAR = new Date().getFullYear()
const M = new Date().getMonth() + 1
const pad = (n: number) => String(n).padStart(2, '0')

export const demoStore = {
  defaultSalary: 3900,
  fixedExpenses: [
    mkFixed('Aluguel', 1500),
    mkFixed('Academia', 120),
    mkFixed('Internet', 100),
    mkFixed('Streaming', 55),
  ] as FixedExpense[],
  fixedStatus: [] as FixedExpenseStatus[],
  salaries: [
    { id: uid(), user_id: 'demo', year: YEAR, month: 12, salary: 5800 },
  ] as MonthlySalary[],
  transactions: seedTx(),
}

function mkFixed(name: string, amount: number): FixedExpense {
  return { id: uid(), user_id: 'demo', name, amount, active: true, created_at: new Date().toISOString() }
}

function tx(
  month: number,
  description: string,
  amount: number,
  day: number,
  extra: Partial<Transaction> = {},
): Transaction {
  return {
    id: uid(),
    user_id: 'demo',
    year: YEAR,
    month,
    description,
    amount,
    occurred_on: `${YEAR}-${pad(month)}-${pad(day)}`,
    paid: true,
    due_date: null,
    method: null,
    category: null,
    group_id: null,
    created_at: new Date().toISOString(),
    ...extra,
  }
}

function seedTx(): Transaction[] {
  const rows: Transaction[] = [
    tx(M, 'Mercado', 640, 5, { method: 'dinheiro', category: 'Mercado' }),
    tx(M, 'Uber', 90, 8, { method: 'pix', category: 'Transporte' }),
    tx(M, 'Farmácia', 130, 12, {
      paid: false,
      method: 'boleto',
      category: 'Saúde',
      due_date: `${YEAR}-${pad(M)}-25`,
    }),
    tx(Math.max(1, M - 1), 'Presente', 250, 20, { method: 'cartao', category: 'Lazer' }),
    tx(Math.max(1, M - 1), 'Restaurante', 180, 22, { method: 'cartao', category: 'Lazer' }),
    tx(M, 'Conta de luz', 210, 1, {
      paid: false,
      method: 'boleto',
      category: 'Contas',
      due_date: `${YEAR}-${pad(M)}-10`,
    }),
    tx(Math.max(1, M - 1), 'Fatura do cartão', 480, 15, {
      paid: false,
      method: 'cartao',
      category: 'Contas',
      due_date: `${YEAR}-${pad(Math.max(1, M - 1))}-15`,
    }),
  ]
  return rows
}

export { uid as demoId }
