import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/useAuth'

export default function Auth() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    if (mode === 'login') {
      const { error } = await signIn(email.trim(), password)
      if (error) setMsg({ kind: 'error', text: error })
    } else {
      const { error, needsConfirm } = await signUp(email.trim(), password)
      if (error) setMsg({ kind: 'error', text: error })
      else if (needsConfirm)
        setMsg({ kind: 'ok', text: 'Conta criada! Verifique seu e-mail para confirmar e depois faça login.' })
      // se nao precisa confirmar, o onAuthStateChange ja loga automaticamente
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-end gap-[3px] rounded-xl bg-slate-800 p-2">
            <span className="w-1.5 flex-1 rounded-sm bg-emerald-400" style={{ height: '45%' }} />
            <span className="w-1.5 flex-1 rounded-sm bg-emerald-400" style={{ height: '75%' }} />
            <span className="w-1.5 flex-1 rounded-sm bg-rose-400" style={{ height: '100%' }} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Planilha de Gastos</h1>
            <p className="text-xs text-slate-400">Controle o ano inteiro</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-800/60 p-1 text-sm font-semibold">
          <button
            className={`rounded-md py-1.5 transition ${mode === 'login' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
            onClick={() => { setMode('login'); setMsg(null) }}
            type="button"
          >
            Entrar
          </button>
          <button
            className={`rounded-md py-1.5 transition ${mode === 'signup' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
            onClick={() => { setMode('signup'); setMsg(null) }}
            type="button"
          >
            Criar conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">E-mail</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Senha</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
            />
          </div>

          {msg && (
            <p
              className={`rounded-lg px-3 py-2 text-xs ${
                msg.kind === 'error'
                  ? 'bg-rose-500/10 text-rose-300'
                  : 'bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {msg.text}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
          Seus dados ficam isolados por conta (Row Level Security do Supabase).
        </p>
      </div>
    </div>
  )
}
