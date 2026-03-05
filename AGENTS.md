# Agent Guidelines for Cosmic Frontier

This is a SvelteKit + Svelte 5 site with interactive Three.js 3D scenes. Deployed as a static site (GitHub Pages) using `@sveltejs/adapter-static`.

## Commands

```bash
npm run dev          # Dev server (binds 0.0.0.0)
npm run build        # Production build (outputs to dist/)
npm run preview      # Preview production build
npm run check        # svelte-check type checking
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
- **Path aliases**: Use `$lib/` for imports from `src/lib/`
- Key shared types live in `src/lib/types.ts` (`CarouselItem`, `ModelConfig`, etc.)
- Run `npm run check` to verify type safety

## Styling Guidelines

- **CSS/SCSS**: Use SCSS for stylesheets when needed
- **Design tokens**: All design values (colors, spacing, typography) should use CSS custom properties from `src/styles/tokens.scss`
- **Cube CSS methodology**: Follow low-specificity global styles approach
  - Global styles in `src/styles/global.css` for base element styling
  - Utility classes in `src/styles/utilities/` for reusable patterns
  - Composition classes in `src/styles/compositions/` for layout patterns
  - Block styles in `src/styles/blocks/` for component-scoped styles (e.g., `blog-post.css`, `button.css`, `card.css`, `site-header.css`)
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
  - Pre-allocate temporary vectors/objects to avoid per-frame GC pressure
- **Camera setup**: Prefer orthographic cameras for consistent scaling, use perspective when depth perception is needed
- **Lighting**: Configure ambient and directional lights through simulation config

## Architecture

### Routing (SvelteKit)

- `src/routes/+layout.svelte` — Root layout with Header, Footer, and global styles
- `src/routes/+layout.ts` — Enables `prerender = true` for all pages
- `src/routes/+page.svelte` — Home page (renders `HomePage.svelte`)
- `src/routes/+page.server.ts` — Home page server load: reads `carousel.yaml` and returns typed `CarouselItem[]`
- `src/routes/blog/+page.server.ts` — Blog index data loading (gray-matter)
- `src/routes/blog/[slug]/+page.ts` — Blog post loading via mdsvex + `import.meta.glob`
- `src/routes/join-us/+page.server.ts` — Job listings data loading (js-yaml)
- `src/routes/contact/+page.svelte` — Contact page
- `src/routes/sitemap.xml/+server.ts` — Generates XML sitemap from static pages + blog posts
- `src/routes/+error.svelte` — Custom error page
- `src/app.html` — HTML shell (Google Analytics, meta tags, fonts)

### Dual-Canvas Rendering Pattern

The core visual experience uses **two independent Svelte canvas components**, each owning its own `WebGLRenderer`, shown/hidden by scroll:

1. **EarthCanvas.svelte** — Owns the `EarthScene`. Fades out as the user scrolls past the hero. Accepts `canvasOpacity` and `heroScrollProgress` props, and fires `onReady` when rendering begins.
2. **CarouselCanvas.svelte** — Owns the `CarouselScene`. Lazy-loads Three.js only after `EarthCanvas` signals ready (via `shouldStartLoading`). Embeds `CarouselOverlay.svelte` for slide navigation UI.

`CanvasLoader.svelte` is a shared loading indicator shown inside each canvas while assets load.

**HomePage.svelte** orchestrates both canvases via GSAP ScrollTrigger and passes `carouselData` (loaded server-side from `carousel.yaml`) down to `CarouselCanvas`.

### Scroll-Driven UI Flow

`HomePage.svelte` sets up GSAP ScrollTrigger zones that control:

- `earthTriggeredOpacity` — fades `EarthCanvas` out as the user scrolls through the hero
- `subheroOpacity` — fades the subhero text section as content sections scroll up over it
- `heroScrollProgress` — drives camera zoom on the hero (disabled on mobile/reduced-motion)

`CarouselCanvas.svelte` has its own `isInViewport` state and skips rendering when off-screen.

### Key Simulation Modules

- `EarthScene.ts` — Earth with orbiting telescopes and a reactive starfield. Orthographic camera, post-processing via EffectComposer.
- `CarouselScene.ts` — 3D product carousel with GLB models, planar mirror (Reflector), OrbitControls, and GSAP-driven slide transitions.
- `Telescope.ts` — Orbital mechanics, trail rendering, frustum visualization
- `ReactiveStarfield.ts` — Shader-based starfield responsive to telescope frustum positions
- `Earth.ts` — Textured sphere with custom CRT grid shader
- `ArcLoader.ts` — Animated arc graphic shown in the hero while the scene loads
- `GrainShader.ts` — Film grain post-processing shader (used by EffectComposer in EarthScene)
- `MouseTracker.ts` — Raycasting and mouse–sphere intersection; pre-allocates temporaries to avoid GC pressure
- `projectionUtils.ts` — World-to-NDC projection utilities (pre-allocated temporaries)
- `materialUtils.ts` — Enhances GLB metallic materials with tweakable parameters
- `mathUtils.ts` — Kepler orbit math, spherical coordinates, ray-sphere intersection
- `simulationConfig.ts` — Shared constants for both scenes

Shaders live in `src/components/simulation/shaders/` as TypeScript modules that export inline GLSL strings (`earthShaders.ts`, `reactiveStarfieldShaders.ts`). The `glslify` tagged-template literal is used inside these modules for GLSL includes; bundled via `vite-plugin-glslify`.

### Content

- Blog posts: Markdown in `src/site-content/blog/` with frontmatter (`title`, `date`, `category`, `isDraft`, etc.), compiled by mdsvex
- Job postings: `src/site-content/jobs.yaml`
- Carousel slides: `src/site-content/carousel.yaml` — defines slide title, description, model filename, and camera position/lookAt for each slide
- Dynamic blog routes: `src/routes/blog/[slug]/+page.ts`

### Build Configuration

- `svelte.config.js`: adapter-static (output to `dist/`), mdsvex preprocessor for `.md` files
- `vite.config.ts`: SvelteKit plugin, glslify Vite plugin, manual Rollup chunks for Three.js and GSAP
- GLB models in `static/models/` are meshopt-compressed; CarouselScene loads them with both MeshoptDecoder and DRACOLoader
- HDR environment texture in `static/textures/`
- Static assets (images, models, draco, textures) in `static/`
- Utility scripts in `scripts/`: `optimize-models.sh` (meshopt compression), `deploy-temp.sh`

## General Best Practices

- **Code organization**: Keep components focused and modular
- **Comments**: Use comments to explain "why" not "what", especially for non-obvious implementation details
- **Error handling**: Check for null/undefined before accessing properties, especially for Three.js objects
- **Resource cleanup**: Always clean up Three.js resources (geometries, materials, textures, event listeners) in cleanup functions
- **Reactive patterns**: Prefer `$derived` for computed values, use `$state` only for mutable state that needs to trigger reactivity
- **Performance**: Pre-allocate temporary `THREE.Vector2/3` and similar objects at class construction time, not inside per-frame methods
