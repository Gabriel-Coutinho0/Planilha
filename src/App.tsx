import { useAuth } from './lib/useAuth'
import { isConfigured } from './lib/supabase'
import { DEMO } from './lib/demo'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import SetupNeeded from './components/SetupNeeded'

export default function App() {
  const { loading, session } = useAuth()

  if (DEMO) return <Dashboard />

  if (!isConfigured) return <SetupNeeded />

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
      </div>
    )
  }

  return session ? <Dashboard /> : <Auth />
}
