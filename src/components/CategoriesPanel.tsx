import { useState } from 'react'
import { createPortal } from 'react-dom'
import { setCategoryOrder, sortAlpha, useCategories } from '../lib/categories'
import { CATEGORY_ICON_KEYS } from '../lib/categoryIcons'
import type { CategoryData } from '../lib/useCategoryData'
import CategoryGlyph from './CategoryGlyph'

const PALETTE = [
  '#34d399', '#4ade80', '#a3e635', '#facc15', '#f59e0b', '#fb923c',
  '#ef4444', '#fb7185', '#f472b6', '#c084fc', '#a78bfa', '#818cf8',
  '#60a5fa', '#22d3ee', '#2dd4bf', '#94a3b8',
]

interface Draft {
  id: string | null
  name: string
  color: string
  icon: string
}

const CUSTOM_KEY = 'cat-order-custom-started'
function customStarted(): boolean {
  try {
    return localStorage.getItem(CUSTOM_KEY) === '1'
  } catch {
    return false
  }
}
function markCustomStarted() {
  try {
    localStorage.setItem(CUSTOM_KEY, '1')
  } catch {
    // sem armazenamento: na próxima vez começa de novo da ordem alfabética
  }
}

/** Cadastro de categorias: nome, ícone e cor. */
export default function CategoriesPanel({ api }: { api: CategoryData }) {
  const { list, order } = useCategories()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<{ id: string; name: string; used: number; moveTo: string } | null>(null)

  async function save() {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const { id, ...input } = draft
      if (id) await api.update(id, input)
      else await api.add(input)
      setDraft(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui salvar.')
    } finally {
      setBusy(false)
    }
  }

  async function chooseOrder(next: 'alpha' | 'custom') {
    if (next === order) return
    setError(null)
    try {
      // na primeira vez que personaliza, começa da ordem alfabética que estava na tela (nada pula de lugar);
      // depois disso, voltar a "Personalizada" mantém a ordem que a pessoa montou
      if (next === 'custom' && !customStarted()) {
        await api.reorder(sortAlpha(list))
        markCustomStarted()
      }
      setCategoryOrder(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui mudar a ordem.')
    }
  }

  async function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= list.length) return
    const next = [...list]
    ;[next[index], next[target]] = [next[target], next[index]]
    setError(null)
    try {
      await api.reorder(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui mover.')
    }
  }

  async function askDelete(id: string, name: string) {
    const used = await api.usageOf(name)
    setDeleting({ id, name, used, moveTo: '' })
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await api.remove(deleting.id, deleting.moveTo || null)
      setDeleting(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não consegui apagar.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Categorias</h3>
          <p className="text-[11px] text-slate-500">
            Nome, ícone e cor de cada categoria. Renomear atualiza tudo que já usa ela.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            Ordem:
            <div className="flex rounded-lg bg-slate-800/60 p-0.5">
              {(
                [
                  ['alpha', 'Alfabética'],
                  ['custom', 'Personalizada'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => void chooseOrder(v)}
                  aria-pressed={order === v}
                  className={`rounded-md px-2.5 py-0.5 font-semibold transition ${
                    order === v ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-slate-500">
              {order === 'alpha' ? 'novas entram no lugar certo; "Outro" fica no fim' : 'use ↑ ↓ para mover; vale em todo o app'}
            </span>
          </div>
        </div>
        <button
          className="btn-ghost px-3 py-1 text-xs"
          onClick={() => {
            setError(null)
            setDraft({ id: null, name: '', color: PALETTE[0], icon: 'tag' })
          }}
        >
          + Nova
        </button>
      </div>

      <ul className={`grid grid-cols-1 gap-1.5 ${order === 'alpha' ? 'sm:grid-cols-2' : ''}`}>
        {list.map((c, i) => (
          <li
            key={c.id}
            className="flex items-center gap-2 rounded-lg border border-slate-800 px-2.5 py-1.5 text-sm"
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${c.color}26` }}
            >
              <CategoryGlyph icon={c.icon} color={c.color} className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-slate-200">{c.name}</span>
            {order === 'custom' && (
              <span className="flex shrink-0 gap-0.5">
                <button
                  className="btn-ghost px-1.5 py-0.5 text-xs disabled:opacity-30"
                  onClick={() => void move(i, -1)}
                  disabled={i === 0}
                  title="Subir"
                  aria-label={`Subir ${c.name}`}
                >
                  ↑
                </button>
                <button
                  className="btn-ghost px-1.5 py-0.5 text-xs disabled:opacity-30"
                  onClick={() => void move(i, 1)}
                  disabled={i === list.length - 1}
                  title="Descer"
                  aria-label={`Descer ${c.name}`}
                >
                  ↓
                </button>
              </span>
            )}
            <button
              className="btn-ghost px-2 py-0.5 text-xs"
              onClick={() => {
                setError(null)
                setDraft({ id: c.id, name: c.name, color: c.color, icon: c.icon })
              }}
            >
              editar
            </button>
            <button
              className="btn-danger px-2 py-0.5 text-xs"
              onClick={() => void askDelete(c.id, c.name)}
              title="Apagar categoria"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {draft && (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `${draft.color}26` }}
            >
              <CategoryGlyph icon={draft.icon} color={draft.color} className="h-5 w-5" />
            </span>
            <input
              className="input flex-1"
              placeholder="Nome da categoria"
              value={draft.name}
              autoFocus
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div>
            <p className="mb-1 text-[11px] text-slate-400">Ícone</p>
            <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
              {CATEGORY_ICON_KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  title={k}
                  onClick={() => setDraft({ ...draft, icon: k })}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                    draft.icon === k
                      ? 'border-emerald-500 bg-slate-800'
                      : 'border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <CategoryGlyph icon={k} color={draft.icon === k ? draft.color : '#94a3b8'} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-[11px] text-slate-400">Cor</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={`h-6 w-6 rounded-full border-2 ${draft.color === c ? 'border-white' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
              <label className="ml-1 flex items-center gap-1 text-[11px] text-slate-400">
                outra
                <input
                  type="color"
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-transparent"
                />
              </label>
            </div>
          </div>

          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary flex-1" disabled={busy} onClick={() => void save()}>
              {busy ? 'Salvando…' : draft.id ? 'Salvar' : 'Criar categoria'}
            </button>
            <button className="btn-ghost px-4" onClick={() => setDraft(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!draft && error && <p className="mt-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

      {deleting &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setDeleting(null)}
        >
          <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Apagar "{deleting.name}"?</h2>
            <p className="mt-1 text-sm text-slate-300">
              {deleting.used > 0
                ? `${deleting.used} ${deleting.used === 1 ? 'item usa' : 'itens usam'} esta categoria (lançamentos, fixos, recorrentes ou regras).`
                : 'Nada usa esta categoria.'}
            </p>
            {deleting.used > 0 && (
              <>
                <label className="mb-1 mt-3 block text-xs text-slate-400">O que fazer com eles?</label>
                <select
                  className="input"
                  value={deleting.moveTo}
                  onChange={(e) => setDeleting({ ...deleting, moveTo: e.target.value })}
                >
                  <option value="">Deixar sem categoria</option>
                  {list
                    .filter((c) => c.id !== deleting.id)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        Mover para {c.name}
                      </option>
                    ))}
                </select>
              </>
            )}
            <div className="mt-4 flex gap-2">
              <button className="btn-danger flex-1 py-2" disabled={busy} onClick={() => void confirmDelete()}>
                {busy ? 'Apagando…' : 'Apagar categoria'}
              </button>
              <button className="btn-ghost px-4" onClick={() => setDeleting(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  )
}
