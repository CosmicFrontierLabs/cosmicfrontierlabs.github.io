<script lang="ts">
  import { onMount } from "svelte";
  import type { WebGLRenderer } from "three";
  import type { EarthScene } from "./simulation/EarthScene";
  import CanvasLoader from "./CanvasLoader.svelte";

  interface Props {
    canvasOpacity: number;
    /** 0–1 scroll progress through the hero section, drives camera zoom in the EarthScene */
    heroScrollProgress: number;
    /** Fires when EarthScene assets have loaded and rendering has begun */
    onReady?: () => void;
  }

  let { canvasOpacity, heroScrollProgress = $bindable(0), onReady }: Props = $props();

  const LOAD_TIMEOUT = 15_000; // 15 seconds
  let isEarthReady = $state(false);
  let hadError = $state(false);

  let activeState: "simulation" | "loader" | "error" = $derived.by(() => {
    if (hadError) return "error";
    if (isEarthReady) return "simulation";
    return "loader";
  });

  // Svelte use:action for mouse interaction on the container
  function containerInteraction(node: HTMLDivElement) {
    function handleMouseMove(event: MouseEvent) {
      if (earthScene) {
        const rect = node.getBoundingClientRect();
        const w = node.offsetWidth || node.clientWidth;
        const h = node.offsetHeight || node.clientHeight;
        const x = ((event.clientX - rect.left) / w) * 2 - 1;
        const y = -((event.clientY - rect.top) / h) * 2 + 1;
        earthScene.updateMouseNDC(x, y);
      }
    }

    function handleClick(event: MouseEvent) {
      if (earthScene) {
        const rect = node.getBoundingClientRect();
        const w = node.offsetWidth || node.clientWidth;
        const h = node.offsetHeight || node.clientHeight;
        const x = ((event.clientX - rect.left) / w) * 2 - 1;
        const y = -((event.clientY - rect.top) / h) * 2 + 1;
        earthScene.updateMouseNDC(x, y);
        earthScene.updateMouseTracker();
      }
    }

    node.addEventListener("mousemove", handleMouseMove);
    node.addEventListener("click", handleClick);

    return {
      destroy() {
        node.removeEventListener("mousemove", handleMouseMove);
        node.removeEventListener("click", handleClick);
      },
    };
  }

  let container: HTMLDivElement;
  let resizeObserver: ResizeObserver;
  let renderer: WebGLRenderer | null = null;

  // Scene instance
  let earthScene = $state<EarthScene | null>(null);

  // --- Resize Observer (no THREE dependency) ---
  function setupResizeObserver(): ResizeObserver {
    let prevWidth = container.offsetWidth || container.clientWidth;
    let prevHeight = container.offsetHeight || container.clientHeight;
    const mobileHeightThreshold = 150;

    const observer = new ResizeObserver((entries) => {
      if (renderer && container) {
        const entry = entries[0];
        const width = entry.contentRect.width || entry.borderBoxSize[0]?.inlineSize || container.clientWidth;
        const height = entry.contentRect.height || entry.borderBoxSize[0]?.blockSize || container.clientHeight;

        const widthChanged = Math.abs(width - prevWidth) > 1;
        const heightDelta = Math.abs(height - prevHeight);

        if (!widthChanged && heightDelta > 0 && heightDelta < mobileHeightThreshold) {
          return;
        }

        prevWidth = width;
        prevHeight = height;

        renderer.setSize(width, height);
        earthScene?.resize(width, height);
      }
    });
    observer.observe(container);
    return observer;
  }

  function handleContextLost(event: Event): void {
    event.preventDefault();
    hadError = true;
  }

  onMount(() => {
    let cleanupAnimation: (() => void) | null = null;
    let loadTimeout: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    (async () => {
      // Defer Three.js loading until after first paint
      await new Promise<void>((resolve) => {
        if ("requestIdleCallback" in window) {
          (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(resolve);
        } else {
          setTimeout(resolve, 1);
        }
      });
      if (cancelled) return;

      const THREE = await import("three");
      const { EarthScene: EarthSceneClass } = await import("./simulation/EarthScene");

      if (cancelled) return;

      function createRenderer(container: HTMLDivElement) {
        const newRenderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        });
        newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
        const width = container.offsetWidth || container.clientWidth;
        const height = container.offsetHeight || container.clientHeight;
        newRenderer.setSize(width, height);
        container.appendChild(newRenderer.domElement);
        return newRenderer;
      }

      function startAnimationLoop(): () => void {
        if (!renderer || !earthScene) {
          return () => {};
        }

        const clock = new THREE.Clock();
        let rafId: number;
        let prevHeroScrollProgress: number = heroScrollProgress;

        function animate() {
          rafId = requestAnimationFrame(animate);

          const delta = clock.getDelta();
          const elapsedTime = clock.getElapsedTime();

          // Sync hero scroll progress to earth scene when it changes
          if (prevHeroScrollProgress !== heroScrollProgress && earthScene && container) {
            earthScene.setHeroScrollProgress(heroScrollProgress);
            const width = container.offsetWidth || container.clientWidth;
            const height = container.offsetHeight || container.clientHeight;
            earthScene.updateCamera(width, height);
            prevHeroScrollProgress = heroScrollProgress;
          }

          if (earthScene) {
            earthScene.update(delta, elapsedTime);
            earthScene.render();
          }
        }

        rafId = requestAnimationFrame(animate);

        return () => {
          cancelAnimationFrame(rafId);
          renderer?.dispose();
        };
      }

      // --- 1. Create renderer ---
      try {
        renderer = createRenderer(container);
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
      } catch (error) {
        console.error("EarthCanvas initialization failed:", error);
        hadError = true;
        return;
      }
      if (cancelled) return;

      // Yield a frame so the browser can paint before scene construction
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;

      // --- 2. Build EarthScene and start the render loop ---
      const width = container.offsetWidth || container.clientWidth;
      const height = container.offsetHeight || container.clientHeight;

      try {
        earthScene = new EarthSceneClass(width, height, renderer!);
        resizeObserver = setupResizeObserver();
        cleanupAnimation = startAnimationLoop();
      } catch (error) {
        console.error("EarthCanvas setup failed:", error);
        hadError = true;
        return;
      }

      // --- 3. Wait for EarthScene assets (texture) ---
      loadTimeout = setTimeout(() => {
        if (activeState === "loader") {
          hadError = true;
        }
      }, LOAD_TIMEOUT);

      try {
        await earthScene.loaded;
        isEarthReady = true;
        onReady?.();
      } catch (err) {
        clearTimeout(loadTimeout);
        console.error("EarthScene failed to load:", err);
        hadError = true;
        return;
      }

      clearTimeout(loadTimeout);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      }
      clearTimeout(loadTimeout);
      earthScene?.dispose();
      cleanupAnimation?.();
    };
  });
</script>

<div class="canvas-container" style="--canvas-opacity: {canvasOpacity ?? 0};">
  {#if hadError}
    <div class="canvas-fallback bg-stars" role="alert">
      <p class="canvas-fallback__text">
        Something went wrong loading the 3D scene. Please reload the page or scroll down to view the website without the
        animations.
      </p>
    </div>
  {/if}

  <div
    bind:this={container}
    use:containerInteraction
    class="canvas"
    style="opacity: {isEarthReady ? canvasOpacity : 0}; transition: {isEarthReady ? 'none' : 'opacity 0.8s ease-out'};"
    role="img"
    aria-label="Interactive 3D scene showing Earth with orbiting telescopes"
  ></div>
  <CanvasLoader visible={activeState === "loader"} />
</div>

<style lang="scss">
  .canvas-container {
    position: fixed;
    inset: 0;
    opacity: var(--canvas-opacity, 0);
  }

  .canvas {
    position: absolute;
    inset: 0;
    will-change: transform;
    background-color: var(--body-bg);
    z-index: 1;
  }

  .canvas-fallback {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .canvas-fallback__text {
    max-width: 40ch;
    padding-inline: 0.25em;
    margin: 0 auto;
    font-size: var(--size-step--1);
    text-align: center;
    text-wrap: balance;
  }
</style>
