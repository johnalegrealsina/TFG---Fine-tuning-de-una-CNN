import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // si 5173 esta ocupado, falla (evita romper CORS en :5174)
    host: true, // accesible desde la red (util en Docker)
  },
  preview: {
    port: 5173,
    host: true,
  },
});
