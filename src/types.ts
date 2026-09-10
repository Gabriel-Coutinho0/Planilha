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

export interface Transaction {
  id: string
  user_id: string
  year: number
  month: number
  description: string
  amount: number
  occurred_on: string
  created_at: string
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
}
