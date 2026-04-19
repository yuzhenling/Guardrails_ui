import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Expose CHAT_* from .env to import.meta.env (in addition to VITE_*).
  envPrefix: ['VITE_', 'CHAT_'],
})
