// @ts-check
import { defineConfig } from "astro/config";
import lenis from "astro-lenis";

import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import glslifyPlugin from "vite-plugin-glslify";

// https://astro.build/config
export default defineConfig({
  site: "https://www.cosmicfrontier.org",
  integrations: [sitemap(), svelte(), lenis()],
  vite: {
    plugins: [glslifyPlugin()],
    ssr: {
      noExternal: ["@lucide/astro"],
    },
  },
  devToolbar: {
    enabled: false,
  },
});
