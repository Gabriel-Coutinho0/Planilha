export interface FixedExpense {
  id: string
  user_id: string
  name: string
  amount: number
  active: boolean
  category: string | null
  method: PaymentMethod | null
  /** Banco/conta usado para pagar, ex: "Nubank", "Itaú". Texto livre. */
  bank: string | null
  note: string | null
  /** Primeiro mês/ano em que esse gasto passa a valer. null = sem início definido (vale desde sempre). */
  start_year: number | null
  start_month: number | null
  /** Cartão de crédito em que o gasto é cobrado (entra na fatura e consome limite). */
  card_id: string | null
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
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Lazer',
  'Educação',
  'Assinaturas',
  'Roupas',
  'Contas',
  'Dívidas',
  'Presente',
  'Outro',
] as const

export type Category = (typeof CATEGORIES)[number]

/** Cor de cada categoria (usada no gráfico e nas etiquetas). */
export const CATEGORY_COLOR: Record<string, string> = {
  Mercado: '#34d399',
  Alimentação: '#fb923c',
  Transporte: '#60a5fa',
  Moradia: '#f59e0b',
  Saúde: '#f472b6',
  Lazer: '#a78bfa',
  Educação: '#22d3ee',
  Assinaturas: '#fb7185',
  Roupas: '#c084fc',
  Contas: '#facc15',
  Dívidas: '#ef4444',
  Presente: '#2dd4bf',
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
  note: string | null
  group_id: string | null
  /** Cartão de crédito usado (quando method = 'cartao'). */
  card_id: string | null
  /** Conta bancária de onde o valor sai do saldo (só vale enquanto o lançamento está pago). */
  debit_account_id: string | null
  /** Lançamento criado a partir de um gasto recorrente variável (luz, água…). */
  recurring_id: string | null
  created_at: string
}

/** Gasto que se repete todo mês, mas com valor diferente (luz, água, mercado). */
export interface RecurringExpense {
  id: string
  user_id: string
  name: string
  /** Valor estimado (sugestão na hora de lançar). */
  amount: number
  category: string | null
  method: PaymentMethod | null
  bank: string | null
  card_id: string | null
  /** Dia do mês do vencimento/compra. Com dia, vira conta a pagar; sem dia, já entra pago. */
  day: number | null
  active: boolean
  created_at: string
}

/** Regra: se a descrição contém a palavra-chave, preenche categoria/forma/banco. */
export interface CategoryRule {
  id: string
  user_id: string
  keyword: string
  category: string | null
  method: PaymentMethod | null
  bank: string | null
  created_at: string
}

/** Receita fixa (ex.: salário): prevista todo mês, até você marcar como recebida. */
export interface IncomeTemplate {
  id: string
  user_id: string
  name: string
  amount: number
  /** Dia do mês em que costuma cair. */
  day: number | null
  /** Conta onde o dinheiro entra quando for recebido. */
  account_id: string | null
  active: boolean
  start_year: number | null
  start_month: number | null
  created_at: string
}

/** Receita lançada num mês (13º, freela, ou o salário de um mês específico): pendente ou recebida. */
export interface ExtraIncome {
  id: string
  user_id: string
  year: number
  month: number
  description: string
  amount: number
  /** false = a receber (ainda não entrou, não soma no saldo da conta). */
  received: boolean
  received_on: string | null
  /** Conta que recebe o dinheiro. */
  account_id: string | null
  day: number | null
  /** Receita fixa que originou esta linha. */
  template_id: string | null
  created_at: string
}

/** Limite de gasto mensal de uma categoria. */
export interface CategoryBudget {
  id: string
  user_id: string
  category: string
  amount: number
}

/** Cartão de crédito cadastrado. O limite disponível é calculado, não guardado. */
export interface Card {
  id: string
  user_id: string
  name: string
  /** Banco emissor, usado como "banco" dos lançamentos feitos neste cartão. */
  bank: string | null
  credit_limit: number
  /** Dia do mês em que a fatura fecha (compras a partir desse dia vão pra próxima fatura). */
  closing_day: number
  /** Se preenchido, o fechamento é N dias antes do vencimento (ex.: Nubank = 7) e o dia fixo é ignorado. */
  closing_offset: number | null
  /** Dia do mês em que a fatura vence. */
  due_day: number
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

// ---------- Contas bancárias, caixinhas e investimentos ----------

export type SavingsKind = 'conta' | 'caixinha' | 'investimento'

export const SAVINGS_KIND_LABEL: Record<SavingsKind, string> = {
  conta: 'Conta bancária',
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
  /** Se o saldo desta conta entra na soma do cartão "Patrimônio". */
  include_in_patrimony: boolean
  /** Rende X% do CDI (ex: 100, 115). null = não rende sozinha. */
  cdi_percent: number | null
  /** Meta: valor a juntar e até quando (YYYY-MM-DD). */
  goal_amount: number | null
  goal_date: string | null
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
  /** Lançamento que gerou esta retirada automaticamente (some junto com ele). */
  transaction_id: string | null
  /** Liga as duas pontas de uma transferência entre contas. */
  transfer_id: string | null
  /** Receita que gerou este depósito automaticamente. */
  income_id: string | null
  created_at: string
}

/** Aviso/lembrete escrito pelo próprio usuário (ex: "cartão vence dia 10"). */
export interface Notice {
  id: string
  user_id: string
  text: string
  created_at: string
}

export interface UserSettings {
  user_id: string
  default_salary: number
  /** Abaixo desse valor a sobra do mês aparece em amarelo (alerta), em vez de verde. */
  low_balance_alert: number
  /** CDI atual em % ao ano, usado pra estimar o rendimento das caixinhas. */
  cdi_rate: number
  updated_at: string
}

/** Numeros ja calculados de um mes. */
export interface MonthSummary {
  month: number
  /** Renda total do mês: salário + rendas extras. */
  salary: number
  /** Só o salário (padrão ou específico do mês). */
  baseSalary: number
  /** Soma das rendas extras do mês. */
  extra: number
  /** Quanto da renda do mês já entrou (salário padrão conta como recebido). */
  incomeReceived: number
  /** Quanto ainda está a receber no mês. */
  incomePending: number
  fixedTotal: number
  variableTotal: number
  spent: number
  remaining: number
  pendingTotal: number
  pendingCount: number
}
