# Planilha de Gastos

App web para controlar gastos do **ano inteiro**: salário por mês, gastos fixos
(que se repetem todo mês), lançamentos variáveis, e quanto **sobra** do salário —
em **verde** quando sobra e **vermelho** quando estoura.

- **Frontend:** React + Vite + TypeScript + Tailwind + Recharts
- **Login + banco:** Supabase (plano grátis) com **Row Level Security** — cada
  conta só enxerga os próprios dados
- **Hospedagem:** Vercel (plano grátis)
- **PWA:** instalável no celular/desktop, abre offline (dados só de leitura)

---

## Rodar localmente

```bash
npm install
npm run demo     # abre em http://localhost:5173 com dados FICTÍCIOS (sem login)
```

Para rodar de verdade (com Supabase), veja abaixo.

---

## 1. Criar o projeto no Supabase (grátis)

1. Entre em <https://supabase.com/dashboard> e crie um projeto (guarde a senha do
   banco; a região pode ser a mais próxima).
2. Menu **SQL Editor → New query**, cole todo o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
   Isso cria as tabelas e as regras de segurança.
3. Menu **Authentication → Sign In / Providers → Email**: deixe **Email** ativado.
   Como você pediu login **sem confirmação**, vá em
   **Authentication → Sign In / Providers → Email** e **desative "Confirm email"**
   (ou em *Auth → Settings*, dependendo da versão do painel).
   Assim o cadastro já entra direto.
4. Menu **Project Settings → API**: copie a **Project URL** e a
   **anon public key**.

## 2. Configurar as variáveis

Crie um arquivo `.env` na raiz (copie de [`.env.example`](.env.example)):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Teste local:

```bash
npm run dev
```

Crie sua conta na tela inicial e comece a usar.

## 3. Subir na Vercel (grátis)

1. Suba este código para um repositório no GitHub.
2. Em <https://vercel.com> → **Add New → Project** → importe o repositório.
3. A Vercel detecta Vite sozinha. Em **Environment Variables**, adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy.** Pronto: você recebe uma URL `https://...vercel.app`.
5. Copie essa URL e cole no Supabase em
   **Authentication → URL Configuration → Site URL** (e em *Redirect URLs*).

Cada `git push` na branch principal gera um novo deploy automático.

---

## Segurança

- As tabelas têm **Row Level Security** ligada: toda linha é filtrada por
  `auth.uid() = user_id`. Mesmo com a `anon key` pública (ela é feita para ficar
  no navegador), ninguém acessa dados de outra conta.
- A `anon key` **pode** ficar no frontend. A chave que **nunca** deve aparecer no
  código nem no navegador é a `service_role` — não use ela aqui.
- Sessão fica em cookie/localStorage e renova sozinha (`autoRefreshToken`).
- Quiser reforçar: em *Authentication → Policies* dá pra exigir senha forte, e em
  *Auth → Rate limits* limitar tentativas de login.

## Como as contas ficam

Como você é o único usuário, basta criar **uma conta**. Se um dia outra pessoa
criar conta no mesmo app, os dados dela ficam totalmente separados dos seus.

---

## Estrutura

```
src/
  App.tsx                  decide entre login / dashboard / setup
  lib/
    supabase.ts            client do Supabase
    useAuth.tsx            contexto de login (entrar, cadastrar, sair)
    useYearData.ts         carrega e calcula os números do ano
    format.ts              R$, meses, parserde valores "1.234,56"
    demo.ts / demoStore.ts modo demonstração (npm run demo)
  components/
    Auth.tsx               tela de login/cadastro
    Dashboard.tsx          resumo do ano + grade de 12 meses + toast de desfazer
    Header.tsx             seletor de ano, sair
    StatCard.tsx           cartões de total (verde/vermelho)
    MonthCard.tsx          cartão de cada mês com barra de progresso
    MonthDetail.tsx        modal do mês: salário, fixos do mês, lançamentos
    InstallmentModal.tsx   criar parcelamento
    BillsPanel.tsx         "Contas a pagar" do ano (lançamentos + fixos)
    CategoryChart.tsx      rosca de gastos por categoria (com filtro e drill-down)
    FixedExpensesPanel.tsx CRUD de gastos fixos
    SavingsPanel.tsx       lista de caixinhas/investimentos com saldo
    SavingsDetailModal.tsx histórico + depósito/retirada de uma caixinha
    SummaryChart.tsx       gráfico salário x gasto x sobra (mês a mês / acumulado)
    Toast.tsx              aviso com ação (desfazer)
scripts/gen-icons.mjs      gera os ícones PNG do PWA
supabase/schema.sql        rode no SQL Editor do Supabase
```

## Modelo de dados

| Tabela            | Para quê                                                              |
| ----------------- | ------------------------------------------------------------------- |
| `user_settings`   | salário padrão mensal                                              |
| `fixed_expenses`  | gastos que repetem todo mês (ativar/desativar)                     |
| `monthly_salary`  | salário específico de um mês (sobrescreve o padrão)                |
| `transactions`         | lançamentos e contas: data, descrição, valor, `paid`, `due_date`, `method` (boleto/cartão/pix/dinheiro/outro), `category`, `bank` (texto livre, ex: "Nubank"), `group_id` (parcelamento) |
| `fixed_expense_status` | marca se um gasto fixo foi pago num mês específico (`fixed_expense_id`, `year`, `month`, `paid`) |
| `savings_accounts`     | caixinhas e investimentos: nome, `kind` (caixinha/investimento), `institution` (onde está guardado) |
| `savings_movements`    | depósitos e retiradas de uma caixinha/investimento (`account_id`, `amount`, `kind`, `occurred_on`, `note`) |

Cálculo de cada mês:
`sobra = salário − (soma dos fixos ativos + soma dos lançamentos do mês)`
— contas ainda **não pagas** também entram no gasto; o painel "Contas a pagar"
e os selos "a pagar" só ajudam a acompanhar o que falta quitar.

> Já tinha rodado uma versão anterior do `schema.sql`? Pode rodar de novo: o
> script é idempotente — cria a tabela `fixed_expense_status` se faltar e
> adiciona as colunas novas via `alter table ... add column if not exists`.

### Contas a pagar e parcelamento

- Cada lançamento tem um **check de pago** e, opcionalmente, **vencimento** e
  **forma de pagamento**. Vencidas aparecem em vermelho.
- **+ Parcelamento** cria uma conta a pagar por mês (com vencimento no dia
  escolhido), avançando o ano quando passa de dezembro. Todas as parcelas
  compartilham um `group_id`.
- Apagar **uma** parcela pede confirmação e remove **todas** as parcelas do
  mesmo parcelamento, inclusive as de outros anos.

### Contas atrasadas

- Conta não paga com vencimento no passado aparece como **atrasada** (vermelho) e
  um **alerta no topo do dashboard** (`⚠️ N contas atrasadas`) leva até a lista.
- A conta **não** rola de mês sozinha (o histórico de cada mês continua fiel).
  Quando quiser, o botão **"adiar →"** move a conta para o mês seguinte, ajusta o
  vencimento e marca a descrição com `(adiada de <mês>)`.
- Qualquer lançamento pode ser editado pelo botão **✎** no modal do mês.
- Excluir um lançamento simples mostra um aviso com **"Desfazer"** por alguns
  segundos (parcelamento continua pedindo confirmação, sem desfazer).

### Categorias

- Cada lançamento pode receber uma **categoria** (Mercado, Transporte, Moradia,
  Saúde, Lazer, Educação, Assinaturas, Roupas, Contas, Outro).
- O painel **"Gastos por categoria"** filtra por ano ou por mês, tem um toggle
  **"incluir fixos"** e deixa clicar numa fatia (ou na legenda) pra ver a lista
  dos lançamentos daquela categoria.

### Banco/conta de cada despesa

- Além da forma de pagamento (boleto/cartão/pix/…), dá pra dizer **em qual
  banco** a despesa caiu — campo de texto livre com sugestões (Nubank, Itaú,
  Bradesco, Inter, C6, XP…) que também lembra os bancos que você já digitou.
- Aparece como uma etiqueta azul nas listas: "Cartão · Nubank".

### Caixinhas e investimentos

- Painel **"Caixinhas e investimentos"** com o saldo de cada uma e o total
  guardado / investido.
- **+ Nova** cria uma caixinha ou investimento: nome, tipo, onde está guardado
  (ex: Nubank, XP) e um saldo inicial opcional.
- Clicar numa abre o histórico com **Depositar** / **Retirar** (valor, data,
  nota) — o saldo é sempre a soma dos depósitos menos as retiradas.

### Gastos fixos pagos por mês

- No modal do mês, a seção **"Gastos fixos do mês"** tem um check por gasto fixo,
  com atalho **"marcar todos pagos"**.
- Fixo não pago do mês corrente (e de meses anteriores) conta no total
  "a pagar" do mês e aparece no painel "Contas a pagar".

### App instalável (PWA)

- Dá pra **instalar** no celular ou no desktop (menu do navegador → "Instalar
  app" / "Adicionar à tela inicial").
- Abre **offline** mostrando os últimos dados carregados (a edição precisa de
  internet). Ícones em `public/pwa-*.png` — regere com `npm run gen:icons`.
