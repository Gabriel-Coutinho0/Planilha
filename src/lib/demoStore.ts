import { defaultCategoryList, type Category } from './categories'
import type {
  Card,
  CategoryRule,
  ExtraIncome,
  IncomeTemplate,
  CategoryBudget,
  RecurringExpense,
  FixedExpense,
  FixedExpenseStatus,
  MonthlySalary,
  Notice,
  SavingsAccount,
  SavingsMovement,
  Transaction,
  TxShare,
  FixedShare,
  FixedShareStatus,
} from '../types'

/** Store em memória para o modo demonstração. Zera ao recarregar a página. */
const uid = () => Math.random().toString(36).slice(2)
const YEAR = new Date().getFullYear()
const M = new Date().getMonth() + 1
const pad = (n: number) => String(n).padStart(2, '0')
const DEMO_CARD_ID = uid()

export const demoStore = {
  defaultSalary: 3900,
  lowBalanceAlert: 300,
  cdiRate: 14.9,
  fixedExpenses: [
    mkFixed('Aluguel', 1500, 'Moradia', 'boleto'),
    mkFixed('Academia', 120, 'Saúde', 'cartao', 'Nubank', null, null, null, DEMO_CARD_ID),
    mkFixed('Internet', 100, 'Contas', 'boleto'),
    mkFixed('Streaming', 55, 'Assinaturas', 'cartao', 'Nubank', 'Plano família, dividido com 3 pessoas', null, null, DEMO_CARD_ID),
    // exemplo de gasto fixo que só passou a valer a partir deste mês
    mkFixed('Curso online', 90, 'Educação', 'cartao', null, null, YEAR, M),
  ] as FixedExpense[],
  fixedStatus: [] as FixedExpenseStatus[],
  salaries: [
    { id: uid(), user_id: 'demo', year: YEAR, month: 12, salary: 5800 },
  ] as MonthlySalary[],
  transactions: seedTx(),
  savingsAccounts: seedSavingsAccounts(),
  savingsMovements: [] as SavingsMovement[],
  shares: [] as TxShare[],
  fixedShares: [] as FixedShare[],
  fixedShareStatus: [] as FixedShareStatus[],
  categories: defaultCategoryList() as Category[],
  budgets: [
    { id: uid(), user_id: 'demo', category: 'Mercado', amount: 800 },
    { id: uid(), user_id: 'demo', category: 'Lazer', amount: 300 },
  ] as CategoryBudget[],
  recurring: [
    {
      id: uid(),
      user_id: 'demo',
      name: 'Conta de luz',
      amount: 210,
      category: 'Contas',
      method: 'boleto',
      bank: 'Itaú',
      card_id: null,
      day: 10,
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      user_id: 'demo',
      name: 'Água',
      amount: 85,
      category: 'Contas',
      method: 'boleto',
      bank: null,
      card_id: null,
      day: 15,
      active: true,
      created_at: new Date().toISOString(),
    },
  ] as RecurringExpense[],
  invoiceBasis: 'closing' as 'closing' | 'due',
  cardAlertPct: 80,
  emergencyMonths: 6,
  rules: [
    {
      id: uid(),
      user_id: 'demo',
      keyword: 'uber',
      category: 'Transporte',
      method: 'pix',
      bank: null,
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      user_id: 'demo',
      keyword: 'ifood',
      category: 'Alimentação',
      method: null,
      bank: null,
      created_at: new Date().toISOString(),
    },
  ] as CategoryRule[],
  extraIncomes: [
    {
      id: uid(),
      user_id: 'demo',
      year: YEAR,
      month: M,
      description: 'Freela de design',
      amount: 500,
      received: true,
      received_on: `${YEAR}-${pad(M)}-02`,
      account_id: null,
      day: null,
      template_id: null,
      created_at: new Date().toISOString(),
    },
  ] as ExtraIncome[],
  incomeTemplates: [] as IncomeTemplate[],
  cards: [
    {
      id: DEMO_CARD_ID,
      user_id: 'demo',
      name: 'Nubank Roxinho',
      bank: 'Nubank',
      credit_limit: 4000,
      closing_day: 20,
      closing_offset: null,
      due_day: 28,
      created_at: new Date().toISOString(),
    },
  ] as Card[],
  notices: [
    { id: uid(), user_id: 'demo', text: 'Cartão Nubank fecha dia 20, vence dia 28.', created_at: new Date().toISOString() },
  ] as Notice[],
}
demoStore.savingsMovements = seedSavingsMovements(demoStore.savingsAccounts)

function mkFixed(
  name: string,
  amount: number,
  category: string | null = null,
  method: FixedExpense['method'] = null,
  bank: string | null = null,
  note: string | null = null,
  startYear: number | null = null,
  startMonth: number | null = null,
  cardId: string | null = null,
): FixedExpense {
  return {
    id: uid(),
    user_id: 'demo',
    name,
    amount,
    active: true,
    category,
    method,
    bank,
    note,
    start_year: startYear,
    start_month: startMonth,
    card_id: cardId,
    account_id: null,
    created_at: new Date().toISOString(),
  }
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
    paid_on: null,
    due_date: null,
    method: null,
    category: null,
    bank: null,
    note: null,
    group_id: null,
    card_id: null,
    debit_account_id: null,
    recurring_id: null,
    created_at: new Date().toISOString(),
    ...extra,
  }
}

function seedTx(): Transaction[] {
  const rows: Transaction[] = [
    tx(M, 'Mercado', 640, 5, { method: 'dinheiro', category: 'Mercado' }),
    tx(M, 'Uber', 90, 8, { method: 'pix', category: 'Transporte', bank: 'Nubank' }),
    tx(M, 'Farmácia', 130, 12, {
      paid: false,
      method: 'boleto',
      category: 'Saúde',
      bank: 'Itaú',
      due_date: `${YEAR}-${pad(M)}-25`,
    }),
    tx(M, 'Cinema', 60, 3, {
      paid: false,
      method: 'cartao',
      category: 'Lazer',
      bank: 'Nubank',
      card_id: DEMO_CARD_ID,
      due_date: `${YEAR}-${pad(M)}-28`,
    }),
    tx(Math.max(1, M - 1), 'Presente', 250, 20, { method: 'cartao', category: 'Lazer', bank: 'Nubank' }),
    tx(Math.max(1, M - 1), 'Restaurante', 180, 22, { method: 'cartao', category: 'Lazer', bank: 'Nubank' }),
    tx(M, 'Conta de luz', 210, 1, {
      paid: false,
      method: 'boleto',
      category: 'Contas',
      bank: 'Itaú',
      due_date: `${YEAR}-${pad(M)}-10`,
    }),
    tx(Math.max(1, M - 1), 'Fatura do cartão', 480, 15, {
      paid: false,
      method: 'cartao',
      category: 'Contas',
      bank: 'Nubank',
      due_date: `${YEAR}-${pad(Math.max(1, M - 1))}-15`,
      note: 'Inclui parcela da geladeira nova (3/10) e assinatura anual do antivírus.',
    }),
  ]
  return rows
}

function seedSavingsAccounts(): SavingsAccount[] {
  return [
    {
      id: uid(),
      user_id: 'demo',
      name: 'Nubank',
      kind: 'conta',
      institution: 'Nubank',
      include_in_patrimony: true,
      cdi_percent: null,
      goal_amount: null,
      goal_date: null,
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      user_id: 'demo',
      name: 'Reserva de emergência',
      kind: 'caixinha',
      institution: 'Nubank',
      include_in_patrimony: true,
      cdi_percent: 115,
      goal_amount: null,
      goal_date: null,
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      user_id: 'demo',
      name: 'Viagem',
      kind: 'caixinha',
      institution: 'Nubank',
      // exemplo de caixinha fora do patrimônio (já tem destino certo, não conta como "livre")
      include_in_patrimony: false,
      cdi_percent: 100,
      goal_amount: 5000,
      goal_date: `${YEAR}-12-31`,
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      user_id: 'demo',
      name: 'Tesouro Selic',
      kind: 'investimento',
      institution: 'XP',
      include_in_patrimony: true,
      cdi_percent: null,
      goal_amount: null,
      goal_date: null,
      created_at: new Date().toISOString(),
    },
  ]
}

function seedSavingsMovements(accounts: SavingsAccount[]): SavingsMovement[] {
  const [contaNubank, reserva, viagem, tesouro] = accounts
  const mk = (
    accountId: string,
    amount: number,
    kind: 'deposito' | 'retirada',
    day: number,
    note?: string,
  ): SavingsMovement => ({
    id: uid(),
    user_id: 'demo',
    account_id: accountId,
    amount,
    kind,
    occurred_on: `${YEAR}-${pad(M)}-${pad(day)}`,
    note: note ?? null,
    transaction_id: null,
    transfer_id: null,
    income_id: null,
    source_key: null,
    created_at: new Date().toISOString(),
  })
  // movimentações antigas, pra o rendimento estimado já aparecer na demo
  const mkAgo = (
    accountId: string,
    amount: number,
    kind: 'deposito' | 'retirada',
    daysAgo: number,
    note?: string,
  ): SavingsMovement => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    return {
      ...mk(accountId, amount, kind, 1, note),
      occurred_on: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    }
  }
  return [
    mk(contaNubank.id, 3200, 'deposito', 1, 'Saldo atual'),
    mkAgo(reserva.id, 2000, 'deposito', 90, 'Depósito inicial'),
    mkAgo(reserva.id, 500, 'deposito', 45),
    mk(viagem.id, 300, 'deposito', 5),
    mk(viagem.id, 100, 'retirada', 20, 'Passagem'),
    mk(tesouro.id, 1000, 'deposito', 3, 'Aporte mensal'),
  ]
}

export { uid as demoId }
