import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // recharts sozinho passa de 500kB; o limite so evita o aviso no build.
    chunkSizeWarningLimit: 900,
  },
})
