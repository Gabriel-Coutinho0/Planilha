export default function SetupNeeded() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-lg p-8">
        <h1 className="text-lg font-bold">Falta conectar o Supabase</h1>
        <p className="mt-2 text-sm text-slate-400">
          O app não encontrou as variáveis de ambiente. Configure e recarregue.
        </p>

        <ol className="mt-4 space-y-3 text-sm text-slate-300">
          <li>
            <span className="font-semibold text-slate-100">1.</span> Crie um projeto grátis em{' '}
            <a
              className="text-emerald-400 underline"
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              supabase.com
            </a>
            .
          </li>
          <li>
            <span className="font-semibold text-slate-100">2.</span> Em{' '}
            <em>Project Settings → API</em>, copie a <em>Project URL</em> e a{' '}
            <em>anon public key</em>.
          </li>
          <li>
            <span className="font-semibold text-slate-100">3.</span> Local: crie um arquivo{' '}
            <code className="rounded bg-slate-800 px-1">.env</code> na raiz com:
            <pre className="mt-1 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">
{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...`}
            </pre>
          </li>
          <li>
            <span className="font-semibold text-slate-100">4.</span> Na Vercel: adicione as mesmas
            variáveis em <em>Settings → Environment Variables</em> e faça um novo deploy.
          </li>
          <li>
            <span className="font-semibold text-slate-100">5.</span> No Supabase, rode o script{' '}
            <code className="rounded bg-slate-800 px-1">supabase/schema.sql</code> no{' '}
            <em>SQL Editor</em>.
          </li>
        </ol>
      </div>
    </div>
  )
}
