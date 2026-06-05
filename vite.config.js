import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/split-california/",
  build: {
    outDir: "docs",
  },
  plugins: [react()],
});
