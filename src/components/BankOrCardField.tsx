import type { Card, PaymentMethod } from '../types'

/** Campo de banco; vira seleção de cartão quando a forma de pagamento é "cartão". */
export default function BankOrCardField({
  method,
  bank,
  onBank,
  cardId,
  onCard,
  cards,
  knownBanks,
  listId,
  onNewCard,
  className = 'input',
}: {
  method: PaymentMethod | ''
  bank: string
  onBank: (v: string) => void
  cardId: string
  onCard: (id: string) => void
  cards: Card[]
  knownBanks: string[]
  listId: string
  /** Se vier, mostra a opção "+ Novo cartão…" na lista. */
  onNewCard?: () => void
  className?: string
}) {
  if (method === 'cartao' && (cards.length > 0 || onNewCard)) {
    return (
      <select
        className={className}
        value={cardId}
        onChange={(e) => (e.target.value === '__new' ? onNewCard?.() : onCard(e.target.value))}
      >
        <option value="">Cartão…</option>
        {cards.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        {onNewCard && <option value="__new">+ Novo cartão…</option>}
      </select>
    )
  }
  return (
    <>
      <input
        className={className}
        placeholder="Banco…"
        list={listId}
        value={bank}
        onChange={(e) => onBank(e.target.value)}
      />
      <datalist id={listId}>
        {knownBanks.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
    </>
  )
}
