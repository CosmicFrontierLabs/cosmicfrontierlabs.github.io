TODO:

- Explore mouse effect on hero
- Check A11y
  - Basd on A11y change, move the fixed position of the menu hamburger.
  - Fix the h1 on home page styling. It changed
- Flashing of the carousel overlay - maybe z fighting
- Review site with reduced motion enabled
- Check lighthouse

NOTES

- It's mesh_0_55 that gets the mirror


- Lazy-load the Three.js scene. Don't block initial page load with it. Load Three.js and your scene assets after the critical content has painted. Use requestIdleCallback or trigger loading after DOMContentLoaded. Show a static image or CSS gradient placeholder first, then swap in the 3D scene.
- Use <canvas> with willReadFrequently: false and make sure you're not forcing synchronous layout. Also set powerPreference: "high-performance" on your WebGL context.
- Reduce draw calls and geometry complexity. Fewer triangles, merged geometries, instanced meshes where possible. Use compressed textures (Basis/KTX2 via KTX2Loader). Resize textures to the minimum needed resolution.
- Limit pixel ratio: renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) — rendering at 3x on high-DPI screens kills performance for no visible benefit.

Others

- Code-split Three.js into its own chunk so it doesn't bloat your main bundle
- Use modulepreload for the Three.js chunk if you want it ready sooner
- Make sure your loader isn't blocking LCP — Lighthouse cares about Largest Contentful Paint, and if your loader is the LCP element sitting there for 3+ seconds, that's a direct hit
- Consider rendering a single static frame on the server or at build time as a fallback/placeholder image
- If the animation is simple enough, consider whether CSS animations or a Lottie could achieve a similar effect at a fraction of the cost
