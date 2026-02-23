# Agent Guidelines for Cosmic Frontier

This is an Astro 5 + Svelte 5 site with interactive Three.js 3D scenes. Deployed as a static site (GitHub Pages).

## Commands

```bash
npm run dev          # Dev server at http://localhost:4321 (binds 0.0.0.0)
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Astro type checking (uses --max-old-space-size=8192)
npm run format       # Prettier format all files
```

No test framework is configured.

## Svelte 5 Conventions

When writing Svelte components:

- **Never use stores** - Use runes instead
- **Use runes for reactive state**:
  - `$state` - For mutable reactive state
  - `$derived` - For computed/derived values that depend on other state
  - `$effect` - Use judiciously, only when side effects are necessary (e.g., DOM manipulation, subscriptions)
- **Prefer `$derived` and secondly function calls over `$effect`** when possible - derived values are more efficient and declarative
- **Component structure**: Keep reactive logic in `<script>` tags, use runes for all reactive variables

## TypeScript

- **Type safety**: All code should be properly typed
- **Three.js types**: Use `@types/three` for Three.js type definitions
- **Import patterns**: Use TypeScript imports for type checking
- Run `npm run check` to verify type safety

## Styling Guidelines

- **CSS/SCSS**: Use SCSS for stylesheets when needed
- **Design tokens**: All design values (colors, spacing, typography) should use CSS custom properties from `src/styles/tokens.scss`
- **Cube CSS methodology**: Follow low-specificity global styles approach
  - Global styles in `src/styles/global.css` for base element styling
  - Utility classes in `src/styles/utilities/` for reusable patterns
  - Composition classes in `src/styles/compositions/` for layout patterns
- **Color system**: Use design tokens (e.g., `var(--color-primary)`, `var(--color-text)`) instead of hardcoded colors
- **Typography**: Use size step variables (`--size-step-0`, `--size-step-1`, etc.) and font family tokens
- **Z-index layers** defined in `src/styles/tokens.scss`: simulation=1, hero=2, subhero=3, items=4, carousel-ui=10; canvas elevates to 13 when carousel is active

## Three.js Patterns

- **Component organization**: Three.js simulation code should be in separate TypeScript classes/modules under `src/components/simulation/`
- **Post-processing**: Use EffectComposer with RenderPass and custom shader passes as needed
- **Performance considerations**:
  - Limit pixel ratio: `Math.min(window.devicePixelRatio, 2.0)` to prevent excessive rendering
  - Use ResizeObserver for responsive canvas sizing
  - Clean up resources (dispose geometries, materials, textures) when components unmount
- **Camera setup**: Prefer orthographic cameras for consistent scaling, use perspective when depth perception is needed
- **Lighting**: Configure ambient and directional lights through simulation config

## Architecture

### Dual-Scene Rendering Pattern

The core visual experience uses **two Three.js scenes sharing one WebGLRenderer**, orchestrated by scroll position:

1. **EarthScene** (`src/components/simulation/EarthScene.ts`) — Earth with orbiting telescopes and a reactive starfield. Uses an orthographic camera with post-processing (film grain via EffectComposer).
2. **CarouselScene** (`src/components/simulation/CarouselScene.ts`) — 3D product carousel showing GLB telescope models with a planar mirror (Reflector), OrbitControls, and GSAP-driven camera animations between slides.

**Canvas.svelte** owns the WebGLRenderer and animation loop but does not own the scenes — it injects the renderer into each scene class. Scene switching is triggered by GSAP ScrollTrigger in **HomePage.svelte**.

### Scroll-Driven UI Flow

`HomePage.svelte` sets up three GSAP ScrollTrigger zones that control:
- `canvasOpacity` — fades the canvas in/out between sections
- `activeScene` — switches between `"simulation"` and `"carousel"`
- `heroScrollProgress` — drives camera zoom on the hero

`CarouselOverlay.svelte` provides slide navigation UI on top of the carousel scene.

### Key Simulation Modules

- `Telescope.ts` — Orbital mechanics, trail rendering, frustum visualization
- `ReactiveStarfield.ts` — Shader-based starfield responsive to telescope frustum positions
- `Earth.ts` — Textured sphere with custom CRT grid shader
- `materialUtils.ts` — Enhances GLB metallic materials with tweakable parameters
- `mathUtils.ts` — Kepler orbit math, spherical coordinates, ray-sphere intersection
- `carouselData.ts` — Slide definitions (camera positions, model visibility, text)
- `simulationConfig.ts` — Shared constants for both scenes

GLSL shaders are in `src/components/simulation/shaders/` and bundled via `vite-plugin-glslify`.

### Content

- Blog posts: Markdown in `src/site-content/blog/` with frontmatter (`title`, `date`, `category`, `isDraft`, etc.)
- Job postings: `src/site-content/jobs.yaml`
- Dynamic blog routes: `src/pages/blog/[slug].astro`
- Decap CMS integration for content management

### Build Configuration

- `astro.config.mjs`: Svelte + Sitemap integrations, glslify Vite plugin, manual Rollup chunks for Three.js and GSAP
- GLB models in `public/models/` are meshopt-compressed; CarouselScene loads them with both MeshoptDecoder and DRACOLoader
- HDR environment texture in `public/textures/`

## General Best Practices

- **Code organization**: Keep components focused and modular
- **Comments**: Use comments to explain "why" not "what", especially for non-obvious implementation details
- **Error handling**: Check for null/undefined before accessing properties, especially for Three.js objects
- **Resource cleanup**: Always clean up Three.js resources (geometries, materials, textures, event listeners) in cleanup functions
- **Reactive patterns**: Prefer `$derived` for computed values, use `$state` only for mutable state that needs to trigger reactivity
