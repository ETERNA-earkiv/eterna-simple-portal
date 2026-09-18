import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [react()],
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // Secrets läses vid runtime, aldrig vid build. access: 'secret' hindrar
  // Vite från att baka in värdet i bundlen — med import.meta.env hamnade
  // lösenordet i klartext i dist/.
  env: {
    schema: {
      RODA_API_URL: envField.string({
        context: 'server',
        access: 'public',
        default: 'http://localhost:8080',
      }),
      PORTAL_SERVICE_USER: envField.string({ context: 'server', access: 'secret' }),
      PORTAL_SERVICE_PASSWORD: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  devToolbar: { enabled: false },
  server: {
    host: true,
    port: 4321,
  },
  vite: {
    // Förbundla de lazy-laddade nedladdningsberoendena redan vid uppstart.
    // Annars upptäcker Vite dem först vid första "Öppna och ladda ner fil",
    // optimerar om och byter dep-hash — och eftersom hmr är avstängd kan den
    // inte be webbläsaren ladda om, så importen failar mitt i klicket.
    optimizeDeps: {
      include: ['jspdf', 'jszip', 'file-saver'],
    },
    server: {
      strictPort: true,
      hmr: false,
      proxy: {
        // /api/v2 hanteras av Astro catch-all route (anonymt → RODA guest,
        // inloggad → egen session)
        '/api/portal': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  },
});
