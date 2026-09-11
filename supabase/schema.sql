-- ============================================================
--  Planilha de Gastos — schema do banco (rode no Supabase)
--  Supabase > SQL Editor > New query > cole tudo > Run
-- ============================================================

-- ---------- Configuracoes do usuario (salario padrao) ----------
create table if not exists public.user_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  default_salary  numeric(12,2) not null default 0,
  updated_at      timestamptz not null default now()
);

-- ---------- Gastos fixos (repetem todo mes) ----------
create table if not exists public.fixed_expenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  amount      numeric(12,2) not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists fixed_expenses_user_idx on public.fixed_expenses(user_id);

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

-- ---------- Caixinhas e investimentos ----------
create table if not exists public.savings_accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  kind         text not null default 'caixinha' check (kind in ('caixinha','investimento')),
  institution  text,
  created_at   timestamptz not null default now()
);
create index if not exists savings_accounts_user_idx on public.savings_accounts(user_id);

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

do $$
declare t text;
begin
  foreach t in array array['user_settings','fixed_expenses','fixed_expense_status','monthly_salary','transactions','savings_accounts','savings_movements']
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
