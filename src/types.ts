export interface FixedExpense {
  id: string
  user_id: string
  name: string
  amount: number
  active: boolean
  created_at: string
}

export interface MonthlySalary {
  id: string
  user_id: string
  year: number
  month: number
  salary: number
}

export type PaymentMethod = 'boleto' | 'cartao' | 'pix' | 'dinheiro' | 'outro'

export interface Transaction {
  id: string
  user_id: string
  year: number
  month: number
  description: string
  amount: number
  occurred_on: string
  paid: boolean
  due_date: string | null
  method: PaymentMethod | null
  group_id: string | null
  created_at: string
}

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  boleto: 'Boleto',
  cartao: 'Cartão',
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  outro: 'Outro',
}

export interface UserSettings {
  user_id: string
  default_salary: number
  updated_at: string
}

/** Numeros ja calculados de um mes. */
export interface MonthSummary {
  month: number
  salary: number
  fixedTotal: number
  variableTotal: number
  spent: number
  remaining: number
  pendingTotal: number
  pendingCount: number
}
