import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/public": "http://localhost:8000",
      "/private": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
