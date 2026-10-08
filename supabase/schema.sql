-- ============================================================
--  Planilha de Gastos — schema do banco (rode no Supabase)
--  Supabase > SQL Editor > New query > cole tudo > Run
-- ============================================================

-- ---------- Configuracoes do usuario (salario padrao) ----------
create table if not exists public.user_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  default_salary      numeric(12,2) not null default 0,
  low_balance_alert   numeric(12,2) not null default 300,
  updated_at          timestamptz not null default now()
);
alter table public.user_settings add column if not exists low_balance_alert numeric(12,2) not null default 300;
alter table public.user_settings add column if not exists cdi_rate numeric(6,3) not null default 14.9;

-- ---------- Gastos fixos (repetem todo mes) ----------
create table if not exists public.fixed_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  amount      numeric(12,2) not null default 0,
  active      boolean not null default true,
  category    text,
  created_at  timestamptz not null default now()
);
create index if not exists fixed_expenses_user_idx on public.fixed_expenses(user_id);

alter table public.fixed_expenses add column if not exists category text;
alter table public.fixed_expenses add column if not exists method text;
alter table public.fixed_expenses add column if not exists bank text;
alter table public.fixed_expenses add column if not exists note text;
alter table public.fixed_expenses add column if not exists start_year int;
alter table public.fixed_expenses add column if not exists start_month int check (start_month between 1 and 12);

-- ---------- Salario por mes (sobrescreve o padrao quando existe) ----------
create table if not exists public.monthly_salary (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  year     int not null,
  month    int not null check (month between 1 and 12),
  salary   numeric(12,2) not null default 0,
  unique (user_id, year, month)
);
create index if not exists monthly_salary_user_idx on public.monthly_salary(user_id, year);

-- ---------- Lancamentos variaveis por mes ----------
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  year         int not null,
  month        int not null check (month between 1 and 12),
  description   text not null default '',
  amount       numeric(12,2) not null default 0,
  occurred_on  date not null default current_date,
  paid         boolean not null default false,
  due_date     date,
  method       text check (method in ('boleto','cartao','pix','dinheiro','outro')),
  group_id     uuid,
  created_at   timestamptz not null default now()
);
-- Colunas adicionadas depois da 1a versao (roda tanto em tabela nova quanto
-- antiga; precisa vir ANTES dos indices que usam essas colunas).
alter table public.transactions add column if not exists paid     boolean not null default false;
alter table public.transactions add column if not exists due_date date;
alter table public.transactions add column if not exists method   text;
alter table public.transactions add column if not exists group_id uuid;
alter table public.transactions add column if not exists category text;
alter table public.transactions add column if not exists bank     text;
alter table public.transactions add column if not exists note     text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'transactions_method_check'
  ) then
    alter table public.transactions
      add constraint transactions_method_check
      check (method in ('boleto','cartao','pix','dinheiro','outro'));
  end if;
end $$;

create index if not exists transactions_user_period_idx on public.transactions(user_id, year, month);
create index if not exists transactions_group_idx on public.transactions(user_id, group_id);

-- ---------- Status "pago" de cada gasto fixo por mes ----------
create table if not exists public.fixed_expense_status (
  user_id           uuid not null references auth.users(id) on delete cascade,
  fixed_expense_id  uuid not null references public.fixed_expenses(id) on delete cascade,
  year   int not null,
  month  int not null check (month between 1 and 12),
  paid   boolean not null default true,
  primary key (user_id, fixed_expense_id, year, month)
);
create index if not exists fixed_expense_status_user_idx
  on public.fixed_expense_status(user_id, year, month);

-- ---------- Contas bancarias, caixinhas e investimentos ----------
create table if not exists public.savings_accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  kind         text not null default 'caixinha' check (kind in ('conta','caixinha','investimento')),
  institution  text,
  include_in_patrimony boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists savings_accounts_user_idx on public.savings_accounts(user_id);

alter table public.savings_accounts
  add column if not exists include_in_patrimony boolean not null default true;
alter table public.savings_accounts add column if not exists cdi_percent numeric(6,2);

-- Migracao: tabela ja existia sem o tipo "conta" (conta bancaria).
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'savings_accounts_kind_check'
  ) then
    alter table public.savings_accounts drop constraint savings_accounts_kind_check;
  end if;
  alter table public.savings_accounts
    add constraint savings_accounts_kind_check
    check (kind in ('conta','caixinha','investimento'));
end $$;

create table if not exists public.savings_movements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  account_id   uuid not null references public.savings_accounts(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  kind         text not null check (kind in ('deposito','retirada')),
  occurred_on  date not null default current_date,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists savings_movements_user_idx on public.savings_movements(user_id, account_id);

-- ---------- Cartoes de credito ----------
create table if not exists public.cards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  bank         text,
  credit_limit numeric(12,2) not null default 0,
  closing_day  int not null default 1 check (closing_day between 1 and 31),
  due_day      int not null default 10 check (due_day between 1 and 31),
  created_at   timestamptz not null default now()
);
create index if not exists cards_user_idx on public.cards(user_id);

alter table public.cards add column if not exists closing_offset int check (closing_offset between 1 and 28);
alter table public.fixed_expenses add column if not exists card_id uuid references public.cards(id) on delete set null;
-- conta de onde o gasto fixo sai (marcar como pago desconta do saldo dela)
alter table public.fixed_expenses add column if not exists account_id uuid references public.savings_accounts(id) on delete set null;
alter table public.user_settings add column if not exists card_alert_pct numeric(5,2) not null default 80;
-- mes da fatura do cartao: 'closing' = mes em que ela fecha, 'due' = mes em que vence
alter table public.user_settings add column if not exists invoice_month_basis text not null default 'closing';

-- ---------- Orcamento por categoria ----------
create table if not exists public.category_budgets (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  category  text not null,
  amount    numeric(12,2) not null default 0,
  unique (user_id, category)
);

-- ---------- Gastos recorrentes de valor variavel (luz, agua, mercado) ----------
create table if not exists public.recurring_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  amount      numeric(12,2) not null default 0,
  category    text,
  method      text,
  bank        text,
  card_id     uuid references public.cards(id) on delete set null,
  day         int check (day between 1 and 31),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists recurring_expenses_user_idx on public.recurring_expenses(user_id);

alter table public.transactions add column if not exists recurring_id uuid references public.recurring_expenses(id) on delete set null;
create index if not exists transactions_recurring_idx on public.transactions(user_id, recurring_id);

-- Metas das caixinhas e transferencias entre contas
alter table public.savings_accounts add column if not exists goal_amount numeric(12,2);
alter table public.savings_accounts add column if not exists goal_date date;
alter table public.savings_movements add column if not exists transfer_id uuid;
create index if not exists savings_movements_transfer_idx on public.savings_movements(transfer_id);

-- Lancamento ligado a um cartao e/ou a uma conta bancaria (de onde o valor sai do saldo)
alter table public.transactions add column if not exists card_id uuid references public.cards(id) on delete set null;
alter table public.transactions add column if not exists debit_account_id uuid references public.savings_accounts(id) on delete set null;
create index if not exists transactions_card_idx on public.transactions(user_id, card_id);

-- Retirada gerada automaticamente por um lancamento (apaga junto com ele)
alter table public.savings_movements add column if not exists transaction_id uuid references public.transactions(id) on delete cascade;
create index if not exists savings_movements_tx_idx on public.savings_movements(transaction_id);

-- ---------- Regras de categoria automatica ----------
create table if not exists public.category_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  keyword     text not null,
  category    text,
  method      text,
  bank        text,
  created_at  timestamptz not null default now(),
  unique (user_id, keyword)
);

-- ---------- Rendas extras (13o, freela, reembolso) ----------
create table if not exists public.extra_incomes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  year         int not null,
  month        int not null check (month between 1 and 12),
  description  text not null default '',
  amount       numeric(12,2) not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists extra_incomes_user_idx on public.extra_incomes(user_id, year, month);

-- Receitas fixas (salario...): previstas todo mes, viram "recebidas" quando voce confirma
create table if not exists public.income_templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  amount       numeric(12,2) not null default 0,
  day          int check (day between 1 and 31),
  account_id   uuid references public.savings_accounts(id) on delete set null,
  active       boolean not null default true,
  start_year   int,
  start_month  int check (start_month between 1 and 12),
  created_at   timestamptz not null default now()
);
create index if not exists income_templates_user_idx on public.income_templates(user_id);

-- Receitas lancadas (avulsas ou instancias de uma receita fixa): pendentes ou recebidas
alter table public.extra_incomes add column if not exists received boolean not null default true;
alter table public.extra_incomes add column if not exists received_on date;
alter table public.extra_incomes add column if not exists account_id uuid references public.savings_accounts(id) on delete set null;
alter table public.extra_incomes add column if not exists day int check (day between 1 and 31);
alter table public.extra_incomes add column if not exists template_id uuid references public.income_templates(id) on delete set null;

-- Deposito na conta gerado por uma receita recebida (apaga junto)
alter table public.savings_movements add column if not exists income_id uuid references public.extra_incomes(id) on delete cascade;
create index if not exists savings_movements_income_idx on public.savings_movements(income_id);

-- Pagamento de boleto: data em que foi pago e conta de onde saiu o dinheiro
alter table public.transactions add column if not exists paid_on date;
alter table public.fixed_expense_status add column if not exists account_id uuid references public.savings_accounts(id) on delete set null;
alter table public.savings_movements add column if not exists source_key text;
create index if not exists savings_movements_source_idx on public.savings_movements(source_key);

-- Gasto fixo dividido com outras pessoas: quem paga quanto todo mes, e quem ja pagou em cada mes
alter table public.fixed_expenses add column if not exists my_amount numeric(12,2);
create table if not exists public.fixed_shares (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  fixed_expense_id uuid not null references public.fixed_expenses(id) on delete cascade,
  person_name      text not null,
  amount           numeric(12,2) not null default 0,
  since_year       int not null,
  since_month      int not null,
  created_at       timestamptz not null default now()
);
create index if not exists fixed_shares_user_idx on public.fixed_shares(user_id, fixed_expense_id);
create table if not exists public.fixed_share_status (
  user_id        uuid not null references auth.users(id) on delete cascade,
  fixed_share_id uuid not null references public.fixed_shares(id) on delete cascade,
  year           int not null,
  month          int not null,
  paid           boolean not null default false,
  paid_on        date,
  account_id     uuid references public.savings_accounts(id) on delete set null,
  primary key (fixed_share_id, year, month)
);
create unique index if not exists fixed_share_status_uniq on public.fixed_share_status(user_id, fixed_share_id, year, month);

-- Categorias do usuario (nome, icone e cor). Renomear/apagar atualiza o texto nas outras tabelas pelo app.
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text not null default '#94a3b8',
  icon       text not null default 'tag',
  position   int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists categories_user_idx on public.categories(user_id, position);

-- Divisao de gastos: "minha parte" do lancamento e quem deve o resto
alter table public.transactions add column if not exists my_amount numeric(12,2);
create table if not exists public.transaction_shares (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  person_name    text not null,
  amount         numeric(12,2) not null default 0,
  paid           boolean not null default false,
  paid_on        date,
  account_id     uuid references public.savings_accounts(id) on delete set null,
  description    text not null default '',
  year           int not null,
  month          int not null,
  created_at     timestamptz not null default now()
);
create index if not exists transaction_shares_user_idx on public.transaction_shares(user_id, paid);
create index if not exists transaction_shares_tx_idx on public.transaction_shares(transaction_id);

alter table public.user_settings add column if not exists emergency_months int not null default 6;

-- ---------- Avisos/lembretes escritos pelo usuario ----------
create table if not exists public.notices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists notices_user_idx on public.notices(user_id);

-- ============================================================
--  Row Level Security: cada usuario so enxerga os proprios dados
-- ============================================================
alter table public.user_settings         enable row level security;
alter table public.fixed_expenses        enable row level security;
alter table public.fixed_expense_status  enable row level security;
alter table public.monthly_salary        enable row level security;
alter table public.transactions          enable row level security;
alter table public.savings_accounts      enable row level security;
alter table public.savings_movements     enable row level security;
alter table public.notices               enable row level security;
alter table public.cards                 enable row level security;
alter table public.category_budgets      enable row level security;
alter table public.recurring_expenses    enable row level security;
alter table public.category_rules        enable row level security;
alter table public.extra_incomes         enable row level security;
alter table public.income_templates      enable row level security;
alter table public.transaction_shares    enable row level security;
alter table public.categories            enable row level security;
alter table public.fixed_shares          enable row level security;
alter table public.fixed_share_status    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['user_settings','fixed_expenses','fixed_expense_status','monthly_salary','transactions','savings_accounts','savings_movements','notices','cards','category_budgets','recurring_expenses','category_rules','extra_incomes','income_templates','transaction_shares','categories','fixed_shares','fixed_share_status']
  loop
    execute format('drop policy if exists "own_select" on public.%I', t);
    execute format('drop policy if exists "own_insert" on public.%I', t);
    execute format('drop policy if exists "own_update" on public.%I', t);
    execute format('drop policy if exists "own_delete" on public.%I', t);

    execute format('create policy "own_select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own_insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own_update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own_delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;
