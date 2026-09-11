import type {
  FixedExpense,
  FixedExpenseStatus,
  MonthlySalary,
  SavingsAccount,
  SavingsMovement,
  Transaction,
} from '../types'

/** Store em memória para o modo demonstração. Zera ao recarregar a página. */
const uid = () => Math.random().toString(36).slice(2)
const YEAR = new Date().getFullYear()
const M = new Date().getMonth() + 1
const pad = (n: number) => String(n).padStart(2, '0')

export const demoStore = {
  defaultSalary: 3900,
  fixedExpenses: [
    mkFixed('Aluguel', 1500, 'Moradia'),
    mkFixed('Academia', 120, 'Saúde'),
    mkFixed('Internet', 100, 'Contas'),
    mkFixed('Streaming', 55, 'Assinaturas'),
  ] as FixedExpense[],
  fixedStatus: [] as FixedExpenseStatus[],
  salaries: [
    { id: uid(), user_id: 'demo', year: YEAR, month: 12, salary: 5800 },
  ] as MonthlySalary[],
  transactions: seedTx(),
  savingsAccounts: seedSavingsAccounts(),
  savingsMovements: [] as SavingsMovement[],
}
demoStore.savingsMovements = seedSavingsMovements(demoStore.savingsAccounts)

function mkFixed(name: string, amount: number, category: string | null = null): FixedExpense {
  return {
    id: uid(),
    user_id: 'demo',
    name,
    amount,
    active: true,
    category,
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
    due_date: null,
    method: null,
    category: null,
    bank: null,
    group_id: null,
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
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      user_id: 'demo',
      name: 'Reserva de emergência',
      kind: 'caixinha',
      institution: 'Nubank',
      include_in_patrimony: true,
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
      created_at: new Date().toISOString(),
    },
    {
      id: uid(),
      user_id: 'demo',
      name: 'Tesouro Selic',
      kind: 'investimento',
      institution: 'XP',
      include_in_patrimony: true,
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
    created_at: new Date().toISOString(),
  })
  return [
    mk(contaNubank.id, 3200, 'deposito', 1, 'Saldo atual'),
    mk(reserva.id, 2000, 'deposito', 2, 'Depósito inicial'),
    mk(reserva.id, 500, 'deposito', 15),
    mk(viagem.id, 300, 'deposito', 5),
    mk(viagem.id, 100, 'retirada', 20, 'Passagem'),
    mk(tesouro.id, 1000, 'deposito', 3, 'Aporte mensal'),
  ]
}

export { uid as demoId }
