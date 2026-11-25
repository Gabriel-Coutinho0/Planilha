/** Estilo comum dos gráficos (recharts). */
export const AXIS = '#94a3b8'
export const GRID = '#1e293b'

export const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 12,
  fontSize: 12,
}
export const TOOLTIP_LABEL = { color: '#f1f5f9', fontWeight: 600 }
export const TOOLTIP_ITEM = { color: '#e2e8f0' }

/** 1500 → "1,5k" (eixos). */
export const kFormat = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : String(v)

/** Cores com significado: renda/sobra boa, gasto neutro, estouro, previsto. */
export const COLOR = {
  income: '#34d399',
  spent: '#94a3b8',
  over: '#f43f5e',
  balance: '#38bdf8',
  fixed: '#a3b2c7',
  installments: '#a78bfa',
  others: '#fb7185',
}

/** Paleta para séries sem cor própria (bancos, formas de pagamento). */
export const PALETTE = ['#34d399', '#60a5fa', '#f59e0b', '#f472b6', '#a78bfa', '#22d3ee', '#fb7185', '#c084fc', '#facc15', '#4ade80']
