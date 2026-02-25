import { sveltekit } from "@sveltejs/kit/vite";
import glslifyPlugin from "vite-plugin-glslify";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit(), glslifyPlugin()],
  ssr: {
    noExternal: ["gsap"],
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/gsap")) return "gsap";
        },
      },
    },
  },
});
