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
    /** 0–1 scroll progress through the hero section, drives camera zoom */
    heroScrollProgress: number;
  }

  let {
    activeScene = $bindable("simulation"),
    canvasOpacity = $bindable(1),
    heroScrollProgress = $bindable(0),
  }: Props = $props();

  $inspect(heroScrollProgress);

  let isEarthReady = $state(false);
  let isCarouselReady = $state(false);
  let isLoading = $derived(!isEarthReady);

  // Space key held (for pan cursor feedback)
  let spaceHeldForPan = $state(false);

  // Orbit controls state — managed internally, with side-effect sync
  // Prefer to use setOrbitMode() to set this state
  let orbitMode = $state(false);

  // Detect touch-only devices — explore mode requires a mouse
  let isTouchDevice = $state(false);

  // Allow explore interactions only on non-touch devices when carousel is visible and not already in orbit mode
  let allowExplore = $derived(!isTouchDevice && activeScene === "carousel" && !orbitMode && canvasOpacity > 0);

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

  // Error boundary state
  let initError = $state<string | null>(null);
  let webglSupported = $state(true);

  // --- WebGL & Simulation Setup ---
  function checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      return !!gl;
    } catch {
      return false;
    }
  }

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
    initError = "WebGL context was lost. Please reload the page.";
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
      } else if (activeScene === "carousel" && carouselScene) {
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
    let t0 = performance.now();
    console.log("Canvas onMount start time:", t0);
    // Detect touch-only devices (no fine pointer = no mouse)
    isTouchDevice = !window.matchMedia("(pointer: fine)").matches;

    if (!checkWebGLSupport()) {
      webglSupported = false;
      initError =
        "WebGL is not supported in your browser. Please try a modern browser like Chrome, Firefox, or Safari.";
      return;
    }

    let cleanupAnimation: (() => void) | null = null;

    try {
      const width = container.offsetWidth || container.clientWidth;
      const height = container.offsetHeight || container.clientHeight;
      renderer = createRenderer(container);
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

      // Initialize cursorX and cursorY to the center of the container
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

      console.log("EarthScene init time:", performance.now() - t0);
      earthScene = new EarthScene(width, height, renderer);
      console.log("CarouselScene init time:", performance.now() - t0);

      earthScene.loaded
        .then(() => {
          isEarthReady = true;
          console.log("EarthScene ready time:", performance.now() - t0);
        })
        .catch((err) => {
          console.error("EarthScene failed to load:", err);
          initError = "Failed to load 3D scene. Please reload the page.";
        });

      // TODO: load this asynchronously so we don't slow down the view?  // Or is it fast enough?
      carouselScene = new CarouselScene(width, height, renderer);
      console.log("CarouselScene loaded time:", performance.now() - t0);
      carouselScene.onSpaceHeldChange = (held: boolean) => {
        spaceHeldForPan = held;
      };
      carouselScene.loaded
        .then(() => {
          isCarouselReady = true;
          console.log("CarouselScene ready time:", performance.now() - t0);
        })
        .catch((err) => {
          console.error("CarouselScene failed to load:", err);
        });

      console.log("After carouselScene.loaded.then:", performance.now() - t0);

      resizeObserver = setupResizeObserver();
      cleanupAnimation = startAnimationLoop();

      // Mouse/keyboard interaction is handled by the use:containerInteraction action
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Simulation initialization failed:", error);
      initError = `Failed to initialize 3D simulation: ${errorMessage}`;
      return;
    }

    return () => {
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      }

      earthScene?.dispose();
      carouselScene?.dispose();
      perf?.dispose();
      cleanupAnimation?.();
    };
  });
</script>

{#if initError}
  <div class="simulation-fallback">
    <div class="fallback-content">
      <div class="fallback-stars"></div>
      <p class="fallback-message">{initError}</p>
    </div>
  </div>
{/if}

<div
  bind:this={container}
  use:containerInteraction
  class="simulation-viewer"
  class:ready={isEarthReady}
  class:carousel-active={activeScene === "carousel"}
  class:allow-explore={allowExplore}
  class:orbit-mode={orbitMode}
  class:pan-mode={orbitMode && spaceHeldForPan}
  style="opacity: {canvasOpacity};"
  role="button"
  tabindex="-1"
></div>

{#if cursorVisible}
  <div class="explore-cursor" style="transform: translate(calc({cursorX}px - 50%), calc({cursorY}px - 50%));">
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

<div style="opacity: {canvasOpacity * (activeScene === 'carousel' ? 1 : 0)};">
  <CarouselOverlay
    {carouselScene}
    paused={orbitMode}
    onExitOrbit={() => {
      setOrbitMode(false);
    }}
  />
</div>


<div class="loading-indicator" data-visible={isLoading && heroScrollProgress <= 0.5}>
  <div class="loading-indicator__message">Loading 3D simulation...</div>
</div>

<style>
  .simulation-viewer {
    position: fixed;
    inset: 0;
    background-color: var(--body-bg);
    z-index: 1;
    /* Don't transition opacity since it's canvasOpacity, which is controlled by the parent component */
  }

  /* When carousel is active, elevate above all page content */
  .simulation-viewer.carousel-active {
    z-index: 13;
  }

  /* Hide default cursor when explore cursor is showing (mouse devices only) */
  @media (pointer: fine) {
    .simulation-viewer.allow-explore {
      cursor: none;
    }
  }

  .simulation-viewer.orbit-mode {
    cursor: grab;
  }

  .simulation-viewer.orbit-mode:active {
    cursor: grabbing;
  }

  .simulation-viewer.pan-mode {
    cursor: grab !important;
  }

  .simulation-viewer.pan-mode:active {
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

  .explore-cursor__ring {
    position: absolute;
    inset: 0;
    animation: explore-spin 4s linear infinite;
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

  .simulation-fallback {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, #0a0a1a 0%, #1a1a2e 50%, #0a0a1a 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .fallback-content {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: var(--space-m);
  }

  .fallback-message {
    color: var(--color-text-muted, #888);
    font-size: var(--size-step--1, 0.875rem);
    max-width: 40ch;
    margin: 0 auto;
    line-height: 1.5;
  }

  .fallback-stars {
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(2px 2px at 20px 30px, white, transparent),
      radial-gradient(2px 2px at 40px 70px, rgba(255, 255, 255, 0.8), transparent),
      radial-gradient(1px 1px at 90px 40px, white, transparent),
      radial-gradient(2px 2px at 130px 80px, rgba(255, 255, 255, 0.6), transparent),
      radial-gradient(1px 1px at 160px 120px, white, transparent),
      radial-gradient(1px 1px at 200px 50px, rgba(255, 255, 255, 0.7), transparent),
      radial-gradient(2px 2px at 250px 150px, white, transparent),
      radial-gradient(1px 1px at 300px 100px, rgba(255, 255, 255, 0.5), transparent);
    background-size: 350px 200px;
    opacity: 0.5;
  }

  .loading-indicator {
    position: fixed;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--body-bg);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.5s ease-out;

    &[data-visible="true"] {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .loading-indicator__message {
    font-size: var(--size-step--1, 0.875rem);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
