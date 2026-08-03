import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Route-level splitting handles the pages; this pulls the big third-party
    // libraries into their own long-lived chunks so an app-code deploy doesn't
    // invalidate them in users' caches.
    rollupOptions: {
      output: {
        // Rolldown (Vite 8) requires the function form here.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined

          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor-react'
          }
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('quill')) return 'vendor-editor'
          if (id.includes('@dnd-kit')) return 'vendor-dnd'
          if (id.includes('socket.io') || id.includes('engine.io')) return 'vendor-realtime'

          return undefined
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true
      }
    }
  }
})
