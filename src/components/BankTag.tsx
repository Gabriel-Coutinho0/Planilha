export default function BankTag({ bank }: { bank: string | null }) {
  if (!bank) return null
  return (
    <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
      {bank}
    </span>
  )
}
