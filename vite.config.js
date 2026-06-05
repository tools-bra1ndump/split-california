import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/split-california/",
  root: "app",
  build: {
    emptyOutDir: false,
    outDir: "..",
  },
  plugins: [react()],
});
