import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// En développement, le navigateur n'appelle que Vite (http://localhost:5173).
// Vite relaie les requêtes vers les services : pas besoin de CORS côté Spring Boot.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const collector = env.COLLECTOR_URL || 'http://localhost:8081'
  const storage = env.STORAGE_URL || 'http://localhost:8082'
  const analytics = env.ANALYTICS_URL || 'http://localhost:8083'
  const ai = env.AI_URL || 'http://localhost:8085'

  const strip = (prefix) => (path) => path.replace(new RegExp('^' + prefix), '')

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Analytics (8083) : capteurs, mesures, analyses, résumés quotidiens
        '/api': { target: analytics, changeOrigin: true },
        // Service IA (8085) : /ai/api/v1/... -> /api/v1/...
        '/ai': { target: ai, changeOrigin: true, rewrite: strip('/ai') },
        // Contrôles de santé : /svc/<service>/health -> /health
        '/svc/collector': { target: collector, changeOrigin: true, rewrite: strip('/svc/collector') },
        '/svc/storage': { target: storage, changeOrigin: true, rewrite: strip('/svc/storage') },
        '/svc/analytics': { target: analytics, changeOrigin: true, rewrite: strip('/svc/analytics') },
        '/svc/ai': { target: ai, changeOrigin: true, rewrite: strip('/svc/ai') },
      },
    },
  }
})
