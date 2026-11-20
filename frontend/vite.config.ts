import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5150',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Deja JS/CSS en la raíz de dist para que el deploy sea más simple y
    // resistente a herramientas que omiten subcarpetas al subir un ZIP.
    assetsDir: '',
  },
})
