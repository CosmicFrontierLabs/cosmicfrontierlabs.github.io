<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { ThreePerf } from "three-perf";
  import { simulationConfig } from "./simulation/simulationConfig";
  import { EarthScene } from "./simulation/EarthScene";
  import { CarouselScene } from "./simulation/CarouselScene";
  import CarouselOverlay from "./CarouselOverlay.svelte";

  interface Props {
    activeScene: "simulation" | "carousel";
    canvasOpacity: number;
    /** 0–1 scroll progress through the hero section, drives camera zoom in the EarthScene */
    heroScrollProgress: number;
    isLoading: boolean;
  }

  let {
    activeScene = $bindable("simulation"),
    canvasOpacity,
    heroScrollProgress = $bindable(0),
    isLoading = $bindable(true),
  }: Props = $props();

  const LOAD_TIMEOUT = 15_000;  // 15 seconds
  let isEarthReady = $state(false);
  let isCarouselReady = $state(false);
  let hadError = $state(false);

  // Space key held (for pan cursor feedback)
  let spaceHeldForPan = $state(false);

  // Orbit controls state — managed internally, with side-effect sync
  // Prefer to use setOrbitMode() to set this state
  let orbitMode = $state(false);

  // Detect touch-only devices — explore mode requires a mouse
  let isTouchDevice = $state(false);

  // Allow explore interactions only on non-touch devices when carousel is visible and not already in orbit mode
  let allowExplore = $derived(!hadError && !isTouchDevice && activeScene === "carousel" && !orbitMode && canvasOpacity > 0);

  // Mouse cursor position for the "click to explore" circle
  let cursorX = $state(0);
  let cursorY = $state(0);
  let cursorOver = $state(false);
  let cursorVisible = $derived(allowExplore && cursorOver);

  function setOrbitMode(newOrbitMode: boolean) {
    orbitMode = newOrbitMode;
    if (carouselScene) {
      carouselScene.enableOrbitControls = newOrbitMode;
    }
    if (!newOrbitMode && carouselScene) {
      carouselScene.resetPan();
      spaceHeldForPan = false;
    }
  }

  // Svelte use:action for mouse/keyboard interaction on the container
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
      if (allowExplore) {
        cursorX = event.clientX;
        cursorY = event.clientY;
        cursorOver = true;
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
      if (allowExplore) {
        setOrbitMode(true);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === "Enter" || e.key === " ") && allowExplore) {
        e.preventDefault();
        setOrbitMode(true);
      }
    }

    function handleEnter() {
      cursorOver = true;
    }
    function handleLeave() {
      cursorOver = false;
    }

    node.addEventListener("mousemove", handleMouseMove);
    node.addEventListener("click", handleClick);
    node.addEventListener("keydown", handleKeyDown);
    node.addEventListener("mouseenter", handleEnter);
    node.addEventListener("mouseleave", handleLeave);

    return {
      destroy() {
        node.removeEventListener("mousemove", handleMouseMove);
        node.removeEventListener("click", handleClick);
        node.removeEventListener("keydown", handleKeyDown);
        node.removeEventListener("mouseenter", handleEnter);
        node.removeEventListener("mouseleave", handleLeave);
      },
    };
  }

  let container: HTMLDivElement;
  let resizeObserver: ResizeObserver;
  let perf: ThreePerf | null = null;
  let renderer: THREE.WebGLRenderer | null = null;

  // Scene instances
  let earthScene = $state<EarthScene | null>(null);
  let carouselScene = $state<CarouselScene | null>(null);


  // --- WebGL & Canvas Setup ---
  function createRenderer(container: HTMLDivElement): THREE.WebGLRenderer {
    const newRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    const width = container.offsetWidth || container.clientWidth;
    const height = container.offsetHeight || container.clientHeight;
    newRenderer.setSize(width, height);
    container.appendChild(newRenderer.domElement);
    return newRenderer;
  }

  function setupResizeObserver(): ResizeObserver {
    // Track previous dimensions to ignore small height-only changes
    // caused by mobile browser chrome (iOS address bar show/hide)
    let prevWidth = container.offsetWidth || container.clientWidth;
    let prevHeight = container.offsetHeight || container.clientHeight;
    const mobileHeightThreshold = 150; // px — iOS chrome bar is typically ~50-100px

    const observer = new ResizeObserver((entries) => {
      if (renderer && container) {
        const entry = entries[0];
        const width = entry.contentRect.width || entry.borderBoxSize[0]?.inlineSize || container.clientWidth;
        const height = entry.contentRect.height || entry.borderBoxSize[0]?.blockSize || container.clientHeight;

        const widthChanged = Math.abs(width - prevWidth) > 1;
        const heightDelta = Math.abs(height - prevHeight);

        // On mobile, ignore height-only changes from browser chrome show/hide
        if (!widthChanged && heightDelta > 0 && heightDelta < mobileHeightThreshold) {
          return;
        }

        prevWidth = width;
        prevHeight = height;

        renderer.setSize(width, height);
        earthScene?.resize(width, height);
        carouselScene?.resize(width, height);
      }
    });
    observer.observe(container);
    return observer;
  }

  function handleContextLost(event: Event): void {
    event.preventDefault();
    hadError = true;
  }

  function startAnimationLoop(): () => void {
    if (!renderer || !earthScene) {
      return () => {};
    }

    const clock = new THREE.Clock();

    let rafId: number;
    let prevActiveScene: typeof activeScene = activeScene;
    let prevHeroScrollProgress: number = heroScrollProgress;

    function animate() {
      rafId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Reset state when leaving carousel
      if (prevActiveScene === "carousel" && activeScene !== "carousel") {
        setOrbitMode(false);
        cursorOver = false;
      }
      prevActiveScene = activeScene;

      // Sync hero scroll progress to earth scene when it changes
      if (prevHeroScrollProgress !== heroScrollProgress && earthScene && container) {
        earthScene.setHeroScrollProgress(heroScrollProgress);
        const width = container.offsetWidth || container.clientWidth;
        const height = container.offsetHeight || container.clientHeight;
        earthScene.updateCamera(width, height);
        prevHeroScrollProgress = heroScrollProgress;
      }

      // Read activeScene from the reactive prop on each frame
      // (captured via the outer closure over the $props binding)
      if (activeScene === "simulation" && earthScene) {
        earthScene.update(delta, elapsedTime);

        if (perf) perf.begin();
        earthScene.render();
      } else if (activeScene === "carousel" && carouselScene && isCarouselReady) {
        carouselScene.update(delta);

        if (perf) {
          perf.begin();
        }

        if (renderer) {
          renderer.toneMapping = THREE.ACESFilmicToneMapping;
          renderer.toneMappingExposure = 1.0;
          renderer.render(carouselScene.scene, carouselScene.camera);
          renderer.toneMapping = THREE.NoToneMapping;
        }
      }

      if (perf) perf.end();
    }

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      renderer?.dispose();
    };
  }

  onMount(() => {
    // Detect touch-only devices (no fine pointer = no mouse)
    isTouchDevice = !window.matchMedia("(pointer: fine)").matches;

    let cleanupAnimation: (() => void) | null = null;
    let loadTimeout: ReturnType<typeof setTimeout> | undefined;

    let cancelled = false;

    // Async IIFE so we can yield to the browser between heavy steps.
    // The outer onMount returns the cleanup function synchronously.
    (async () => {
      // --- 1. Create renderer ---
      try {
        renderer = createRenderer(container);
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
      } catch (error) {
        console.error("Canvas initialization failed:", error);
        hadError = true;
        isLoading = false;
        return;
      }
      if (cancelled) return;

      cursorX = container.clientWidth / 2;
      cursorY = container.clientHeight / 2;

      if (simulationConfig.perf.enabled) {
        perf = new ThreePerf({
          anchorX: "left",
          anchorY: "top",
          domElement: container,
          renderer: renderer,
        });
      }

      // Yield a frame so the browser can paint before scene construction
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      if (cancelled) return;

      // --- 2. Build EarthScene and start the render loop ---
      const width = container.offsetWidth || container.clientWidth;
      const height = container.offsetHeight || container.clientHeight;

      try {
        earthScene = new EarthScene(width, height, renderer!);
        resizeObserver = setupResizeObserver();
        cleanupAnimation = startAnimationLoop();
      } catch (error) {
        console.error("Canvas setup failed:", error);
        hadError = true;
        isLoading = false;
        return;
      }

      // --- 3. Wait for EarthScene assets (texture) ---
      loadTimeout = setTimeout(() => {
        if (isLoading) {
          isLoading = false;
          hadError = true;
        }
      }, LOAD_TIMEOUT);

      try {
        await earthScene.loaded;
      } catch (err) {
        clearTimeout(loadTimeout);
        console.error("EarthScene failed to load:", err);
        hadError = true;
        isLoading = false;
        return;
      }

      clearTimeout(loadTimeout);
      if (hadError || cancelled) return;

      isEarthReady = true;
      isLoading = false;

      // --- 4. Load CarouselScene after earth is ready ---
      // Deferred so its network/GPU work doesn't compete with the earth texture
      try {
        carouselScene = new CarouselScene(width, height, renderer!);
        carouselScene.onSpaceHeldChange = (held: boolean) => {
          spaceHeldForPan = held;
        };
        await carouselScene.loaded;
        if (!hadError) {
          isCarouselReady = true;
        }
      } catch (err) {
        console.error("CarouselScene failed to load:", err);
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      }

      clearTimeout(loadTimeout);
      earthScene?.dispose();
      carouselScene?.dispose();
      perf?.dispose();
      cleanupAnimation?.();
    };
  });
</script>

<div class="canvas-container" style="--canvas-opacity: {canvasOpacity ?? 0};">
  {#if hadError}
    <div class="canvas-fallback bg-stars" role="alert">
      <p class="canvas-fallback__text">
        Something went wrong loading the 3D scene. Please reload the page or scroll down to view the website without the animations.
      </p>
    </div>
  {/if}

  <div
    bind:this={container}
    use:containerInteraction
    class="canvas"
    class:carousel-active={activeScene === "carousel"}
    class:allow-explore={allowExplore}
    class:orbit-mode={orbitMode}
    class:pan-mode={orbitMode && spaceHeldForPan}
    style="opacity: {isEarthReady ? canvasOpacity : 0}; transition: {isEarthReady ? 'none' : 'opacity 0.8s ease-out'};"
    role="img"
    aria-label="Interactive 3D scene showing Earth with orbiting telescopes"
  ></div>

  {#if cursorVisible}
    <div class="explore-cursor" aria-hidden="true" style="transform: translate(calc({cursorX}px - 50%), calc({cursorY}px - 50%));">
      <svg class="explore-cursor__ring" width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="38" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
        <circle
          cx="40"
          cy="40"
          r="38"
          fill="none"
          stroke="rgba(255,255,255,0.8)"
          stroke-width="1.5"
          stroke-dasharray="60 180"
          stroke-dashoffset="0"
          class="explore-cursor__arc"
        />
      </svg>
      <span class="explore-cursor__label">Click to<br />explore</span>
    </div>
  {/if}

  {#if !hadError}
    <div
      class="carousel-overlay-wrapper"
      class:carousel-overlay-wrapper--hidden={activeScene !== 'carousel'}
      aria-hidden={activeScene !== 'carousel'}
    >
      <CarouselOverlay
        {carouselScene}
        paused={orbitMode}
        {activeScene}
        onExitOrbit={() => {
          setOrbitMode(false);
        }}
      />
    </div>
  {/if}

</div>

<style lang="scss">
  .canvas-container {
    opacity: var(--canvas-opacity, 0);
  }

  .canvas {
    position: fixed;
    inset: 0;
    background-color: var(--body-bg);
    z-index: 1;
    // Be careful with transition on opacity since it's canvasOpacity
    // which is controlled by the parent component
  }

  /* When carousel is active, elevate above all page content */
  .canvas.carousel-active {
    z-index: 13;
  }

  /* Hide default cursor when explore cursor is showing (mouse devices only) */
  @media (pointer: fine) {
    .canvas.allow-explore {
      cursor: none;
    }
  }

  .canvas.orbit-mode {
    cursor: grab;
  }

  .canvas.orbit-mode:active {
    cursor: grabbing;
  }

  .canvas.pan-mode {
    cursor: grab !important;
  }

  .canvas.pan-mode:active {
    cursor: grabbing !important;
  }

  /* Explore cursor */
  .explore-cursor {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 20;
    pointer-events: none;
    will-change: transform;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
  }

  .carousel-overlay-wrapper {
    opacity: 1;
    transition: opacity 0.3s ease;
  }

  .carousel-overlay-wrapper--hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .explore-cursor__ring {
    position: absolute;
    inset: 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .explore-cursor__ring {
      animation: explore-spin 4s linear infinite;
    }
  }

  .explore-cursor__arc {
    filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.4));
  }

  @keyframes explore-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .explore-cursor__label {
    font-size: 0.5625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
    line-height: 1.3;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
  }

  .canvas-fallback {
    position: fixed;
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
