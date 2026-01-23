import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        app: resolve(__dirname, "app.html"),
        login: resolve(__dirname, "login.html"),
        budget: resolve(__dirname, "budget.html"),
        category: resolve(__dirname, "category.html"),
      },
    },
  },
});
