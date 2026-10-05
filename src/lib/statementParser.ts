export interface ParsedRow {
  /** Data da compra (YYYY-MM-DD). */
  date: string
  description: string
  /** Positivo = gasto; negativo = crédito/estorno/pagamento. */
  amount: number
  /** Parece pagamento da fatura ou estorno (vem desmarcado na conferência). */
  isCredit: boolean
  /** Identificador do banco (OFX), quando existe. */
  fitId: string | null
}

export interface ParseResult {
  rows: ParsedRow[]
  format: 'csv' | 'ofx'
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Lê o arquivo escolhendo a codificação (UTF-8, ou Windows-1252 dos bancos mais antigos). */
export async function readFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buf)
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8
}

/** "1.234,56", "-12,30", "R$ 45", "12.30" → número. */
export function parseMoney(raw: string): number | null {
  let s = raw.replace(/[^\d,.\-+]/g, '').trim()
  if (!s || s === '-' || s === '+') return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    // o que vier por último é o separador decimal
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma > -1) {
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

/** Datas YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, YYYYMMDD. */
export function parseDate(raw: string): string | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})[/.-](\d{2})[/.-](\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{2})[/.-](\d{2})[/.-](\d{2})\b/)
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`
  m = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  return null
}

const CREDIT_WORDS = /pagamento (recebido|de fatura|efetuado|fatura)|pagto|estorno|cr[eé]dito de|devolu[cç][aã]o|reembolso|cashback|desconto de/i

function parseCsvLines(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delimiter) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

function detectDelimiter(text: string): string {
  const head = text.split(/\r?\n/).slice(0, 5).join('\n')
  const count = (d: string) => (head.match(new RegExp(d === '|' ? '\\|' : d, 'g')) ?? []).length
  const options = [';', ',', '\t']
  return options.sort((a, b) => count(b) - count(a))[0]
}

function parseCsv(text: string): ParsedRow[] {
  const delimiter = detectDelimiter(text)
  const lines = parseCsvLines(text, delimiter)
  if (lines.length < 2) throw new Error('O arquivo parece vazio.')

  // procura a linha de cabeçalho (alguns bancos põem linhas de título antes)
  let headerIdx = -1
  let dateCol = -1
  let descCol = -1
  let amountCol = -1
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = lines[i].map(norm)
    const d = cols.findIndex((c) => /^(data|date|dt)\b|^data (da )?(compra|lancamento|transacao)/.test(c))
    const t = cols.findIndex(
      (c, idx) =>
        idx !== d &&
        /(descri|title|titulo|historico|estabelecimento|lancamento|merchant|nome|detalhe)/.test(c),
    )
    const a = cols.findIndex((c, idx) => idx !== d && idx !== t && /(^valor|amount|value|quantia)/.test(c))
    if (d > -1 && t > -1 && a > -1) {
      headerIdx = i
      dateCol = d
      descCol = t
      amountCol = a
      break
    }
  }
  if (headerIdx === -1) {
    throw new Error(
      'Não reconheci as colunas. O CSV precisa ter colunas de data, descrição e valor (ex.: date, title, amount).',
    )
  }

  const out: ParsedRow[] = []
  for (const cols of lines.slice(headerIdx + 1)) {
    const date = parseDate(cols[dateCol] ?? '')
    const amount = parseMoney(cols[amountCol] ?? '')
    const description = (cols[descCol] ?? '').trim()
    if (!date || amount == null || !description) continue
    out.push({ date, description, amount, isCredit: false, fitId: null })
  }
  return out
}

function parseOfx(text: string): ParsedRow[] {
  const out: ParsedRow[] = []
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  const tag = (block: string, name: string) =>
    block.match(new RegExp(`<${name}>\\s*([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? ''
  for (const block of blocks) {
    const date = parseDate(tag(block, 'DTPOSTED'))
    const amount = parseMoney(tag(block, 'TRNAMT'))
    const description = (tag(block, 'MEMO') || tag(block, 'NAME')).trim()
    if (!date || amount == null) continue
    out.push({
      date,
      description: description || 'Sem descrição',
      amount,
      isCredit: false,
      fitId: tag(block, 'FITID') || null,
    })
  }
  return out
}

/**
 * Lê CSV ou OFX de fatura. O sinal dos valores varia entre bancos (no Nubank o gasto é
 * positivo; no OFX costuma ser negativo), então o sinal mais comum vira "gasto" e o oposto
 * (pagamento da fatura, estorno) vira crédito.
 */
export function parseStatement(text: string, filename: string): ParseResult {
  const isOfx = /\.ofx$/i.test(filename) || /<OFX>/i.test(text.slice(0, 2000))
  const raw = isOfx ? parseOfx(text) : parseCsv(text)
  if (raw.length === 0) {
    throw new Error('Não encontrei lançamentos nesse arquivo.')
  }

  const candidates = raw.filter((r) => !CREDIT_WORDS.test(r.description))
  const pos = candidates.filter((r) => r.amount > 0).length
  const neg = candidates.filter((r) => r.amount < 0).length
  const expenseSign = pos >= neg ? 1 : -1

  const rows = raw.map((r) => {
    const isExpense = Math.sign(r.amount) === expenseSign && !CREDIT_WORDS.test(r.description)
    return {
      ...r,
      amount: isExpense ? Math.abs(r.amount) : -Math.abs(r.amount),
      isCredit: !isExpense,
    }
  })
  rows.sort((a, b) => a.date.localeCompare(b.date))
  return { rows, format: isOfx ? 'ofx' : 'csv' }
}
