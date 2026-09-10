/**
 * Modo demonstração (VITE_DEMO=1): roda a interface sem Supabase, com dados
 * fictícios guardados só na memória do navegador. Serve para testar o visual
 * antes de configurar login/nuvem. Nada é salvo de verdade.
 */
export const DEMO = import.meta.env.VITE_DEMO === '1'
