# Agent Guidelines for Cosmic Frontier

This is an Astro project with Svelte 5 components.

## Svelte 5 Conventions

When writing Svelte components:

- **Never use stores** - Use runes instead
- **Use runes for reactive state**:
  - `$state` - For mutable reactive state
  - `$derived` - For computed/derived values that depend on other state
  - `$effect` - Use judiciously, only when side effects are necessary (e.g., DOM manipulation, subscriptions)
- **Prefer `$derived` over `$effect`** when possible - derived values are more efficient and declarative
- **Component structure**: Keep reactive logic in `<script>` tags, use runes for all reactive variables

## Code Formatting

- **Prettier** is configured and should be used (`npm run format`)

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

## Three.js Patterns

- **Component organization**: Three.js simulation code should be in separate TypeScript classes/modules under `src/components/simulation/`
- **Post-processing**: Use EffectComposer with RenderPass and custom shader passes as needed
- **Performance considerations**:
  - Limit pixel ratio: `Math.min(window.devicePixelRatio, 2.0)` to prevent excessive rendering
  - Use ResizeObserver for responsive canvas sizing
  - Clean up resources (dispose geometries, materials, textures) when components unmount
- **Camera setup**: Prefer orthographic cameras for consistent scaling, use perspective when depth perception is needed
- **Lighting**: Configure ambient and directional lights through simulation config

## General Best Practices

- **Code organization**: Keep components focused and modular
- **Comments**: Use comments to explain "why" not "what", especially for non-obvious implementation details
- **Error handling**: Check for null/undefined before accessing properties, especially for Three.js objects
- **Resource cleanup**: Always clean up Three.js resources (geometries, materials, textures, event listeners) in cleanup functions
- **Reactive patterns**: Prefer `$derived` for computed values, use `$state` only for mutable state that needs to trigger reactivity
