export interface FixedExpense {
  id: string
  user_id: string
  name: string
  amount: number
  active: boolean
  created_at: string
}

/** Marca se um gasto fixo foi pago num mês específico. Ausência = não pago. */
export interface FixedExpenseStatus {
  user_id: string
  fixed_expense_id: string
  year: number
  month: number
  paid: boolean
}

export interface MonthlySalary {
  id: string
  user_id: string
  year: number
  month: number
  salary: number
}

export type PaymentMethod = 'boleto' | 'cartao' | 'pix' | 'dinheiro' | 'outro'

export const CATEGORIES = [
  'Mercado',
  'Transporte',
  'Moradia',
  'Saúde',
  'Lazer',
  'Educação',
  'Assinaturas',
  'Roupas',
  'Contas',
  'Outro',
] as const

export type Category = (typeof CATEGORIES)[number]

/** Cor de cada categoria (usada no gráfico e nas etiquetas). */
export const CATEGORY_COLOR: Record<string, string> = {
  Mercado: '#34d399',
  Transporte: '#60a5fa',
  Moradia: '#f59e0b',
  Saúde: '#f472b6',
  Lazer: '#a78bfa',
  Educação: '#22d3ee',
  Assinaturas: '#fb7185',
  Roupas: '#c084fc',
  Contas: '#facc15',
  Outro: '#94a3b8',
  'Sem categoria': '#64748b',
  Fixos: '#a3b2c7',
}

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
  category: string | null
  /** Banco/conta onde a despesa foi feita, ex: "Nubank", "Itaú". Texto livre. */
  bank: string | null
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

/** Sugestões pro campo "Banco" (autocomplete); o usuário pode digitar outro. */
export const COMMON_BANKS = [
  'Nubank',
  'Itaú',
  'Bradesco',
  'Santander',
  'Banco do Brasil',
  'Caixa',
  'Inter',
  'C6 Bank',
  'BTG Pactual',
  'PicPay',
  'XP',
  'Dinheiro em espécie',
]

// ---------- Caixinhas e investimentos ----------

export type SavingsKind = 'caixinha' | 'investimento'

export const SAVINGS_KIND_LABEL: Record<SavingsKind, string> = {
  caixinha: 'Caixinha',
  investimento: 'Investimento',
}

export interface SavingsAccount {
  id: string
  user_id: string
  name: string
  kind: SavingsKind
  /** Onde o dinheiro está guardado, ex: "Nubank", "XP", "Banco Inter". */
  institution: string | null
  created_at: string
}

export type MovementKind = 'deposito' | 'retirada'

export interface SavingsMovement {
  id: string
  user_id: string
  account_id: string
  amount: number
  kind: MovementKind
  occurred_on: string
  note: string | null
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
  pendingTotal: number
  pendingCount: number
}
