import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // No `define` block — secrets are never baked into the bundle at build time.
  // Gemini now runs SERVER-SIDE only (see api/server.ts + services/geminiService.ts):
  // the browser calls /api/extract-bill and /api/insights, and the key lives in the
  // server-only GEMINI_API_KEY env var. Do NOT add a VITE_GEMINI_API_KEY variable —
  // any VITE_-prefixed value is inlined into the client bundle and would leak the key.
});
