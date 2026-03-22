import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // No `define` block — secrets are never baked into the bundle at build time.
  // VITE_GEMINI_API_KEY is set in Vercel environment variables and exposed
  // via import.meta.env (Vite's standard pattern for browser-accessible vars).
  // GEMINI_API_KEY (no VITE_ prefix) is used server-side only.
});
