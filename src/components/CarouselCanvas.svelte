<script lang="ts">
  import { onMount } from "svelte";
  import type { WebGLRenderer } from "three";
  import type { CarouselScene } from "./simulation/CarouselScene";
  import CarouselOverlay from "./CarouselOverlay.svelte";

  interface Props {
    canvasOpacity: number;
    /** Gates when to start loading Three.js + CarouselScene */
    loadingEnabled: boolean;
  }

  let { canvasOpacity, loadingEnabled }: Props = $props();

  let hadError = $state(false);
  let isCarouselReady = $state(false);

  let activeScene: "carousel" | "loading" | "idle" = $derived.by(() => {
    if (hadError) return "idle";
    if (isCarouselReady && canvasOpacity > 0) return "carousel";
    if (isCarouselReady) return "idle";
    return "loading";
  });

  // Space key held (for pan cursor feedback)
  let spaceHeldForPan = $state(false);

  // Orbit controls state
  let orbitMode = $state(false);

  // Detect touch-only devices — explore mode requires a mouse
  let isTouchDevice = $state(false);

  // Allow explore interactions only on non-touch devices when carousel is visible
  let allowExplore = $derived(
    !hadError && !isTouchDevice && activeScene === "carousel" && !orbitMode && canvasOpacity > 0
  );

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
      if (allowExplore) {
        cursorX = event.clientX;
        cursorY = event.clientY;
        cursorOver = true;
      }
    }

    function handleClick() {
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
  let renderer: WebGLRenderer | null = null;

  let carouselScene = $state<CarouselScene | null>(null);

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

  // Wait for loadingEnabled to become true, then start loading
  let loadStarted = $state(false);

  $effect(() => {
    if (loadingEnabled && !loadStarted) {
      loadStarted = true;
    }
  });

  onMount(() => {
    isTouchDevice = !window.matchMedia("(pointer: fine)").matches;
    let cleanupAnimation: (() => void) | null = null;
    let cancelled = false;

    // Watch for loadStarted to trigger initialization
    const unsubscribe = $effect.root(() => {
      $effect(() => {
        if (!loadStarted || cancelled) return;

        // Run async initialization
        (async () => {
          const THREE = await import("three");

          if (cancelled) return;

          function createRenderer(container: HTMLDivElement) {
            const newRenderer = new THREE.WebGLRenderer({
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
            });
            newRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
            newRenderer.toneMapping = THREE.ACESFilmicToneMapping;
            newRenderer.toneMappingExposure = 1.0;
            const width = container.offsetWidth || container.clientWidth;
            const height = container.offsetHeight || container.clientHeight;
            newRenderer.setSize(width, height);
            container.appendChild(newRenderer.domElement);
            return newRenderer;
          }

          function startAnimationLoop(): () => void {
            if (!renderer || !carouselScene) {
              return () => {};
            }

            const clock = new THREE.Clock();
            let rafId: number;

            function animate() {
              rafId = requestAnimationFrame(animate);

              // Skip rendering when not visible
              if (canvasOpacity === 0) {
                clock.getDelta(); // keep clock ticking
                return;
              }

              const delta = clock.getDelta();

              if (carouselScene && isCarouselReady) {
                carouselScene.update(delta);

                if (renderer) {
                  renderer.render(carouselScene.scene, carouselScene.camera);
                }
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
            // Ensure the canvas can receive pointer events
            renderer.domElement.style.pointerEvents = "auto";
          } catch (error) {
            console.error("CarouselCanvas initialization failed:", error);
            hadError = true;
            return;
          }
          if (cancelled) return;

          cursorX = container.clientWidth / 2;
          cursorY = container.clientHeight / 2;

          // Yield a frame
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
          if (cancelled) return;

          // --- 2. Build CarouselScene ---
          const width = container.offsetWidth || container.clientWidth;
          const height = container.offsetHeight || container.clientHeight;

          try {
            const { CarouselScene: CarouselSceneClass } = await import("./simulation/CarouselScene");
            carouselScene = new CarouselSceneClass(width, height, renderer!);
            carouselScene.onSpaceHeldChange = (held: boolean) => {
              spaceHeldForPan = held;
            };
            resizeObserver = setupResizeObserver();
            cleanupAnimation = startAnimationLoop();

            await carouselScene.loaded;
            if (!hadError) {
              isCarouselReady = true;
            }
          } catch (err) {
            console.error("CarouselScene failed to load:", err);
            hadError = true;
          }
        })();
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
      resizeObserver?.disconnect();
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      }
      carouselScene?.dispose();
      cleanupAnimation?.();
    };
  });
</script>

<div
  class="carousel-canvas-container"
  class:carousel-canvas-container--visible={canvasOpacity > 0 && isCarouselReady}
  style="opacity: {isCarouselReady ? canvasOpacity : 0};"
>
  <div
    bind:this={container}
    use:containerInteraction
    class="carousel-canvas"
    class:allow-explore={allowExplore}
    class:orbit-mode={orbitMode}
    class:pan-mode={orbitMode && spaceHeldForPan}
    role="img"
    aria-label="Interactive 3D telescope carousel"
  ></div>

  {#if cursorVisible}
    <div
      class="explore-cursor"
      aria-hidden="true"
      style="transform: translate(calc({cursorX}px - 50%), calc({cursorY}px - 50%));"
    >
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

  {#if !hadError && isCarouselReady}
    <div
      class="carousel-overlay-wrapper"
      class:carousel-overlay-wrapper--hidden={canvasOpacity === 0}
      aria-hidden={canvasOpacity === 0}
    >
      <CarouselOverlay
        {carouselScene}
        paused={orbitMode}
        activeScene={activeScene === "carousel" ? "carousel" : "simulation"}
        onExitOrbit={() => {
          setOrbitMode(false);
        }}
      />
    </div>
  {/if}
</div>

<style lang="scss">
  .carousel-canvas-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100lvh;
    pointer-events: none;
    transition: opacity 0.3s ease;
  }

  .carousel-canvas-container--visible {
    pointer-events: auto;
  }

  .carousel-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }

  /* Hide default cursor when explore cursor is showing (mouse devices only) */
  @media (pointer: fine) {
    .carousel-canvas.allow-explore {
      cursor: none;
    }
  }

  .carousel-canvas.orbit-mode {
    cursor: grab;
  }

  .carousel-canvas.orbit-mode:active {
    cursor: grabbing;
  }

  .carousel-canvas.pan-mode {
    cursor: grab !important;
  }

  .carousel-canvas.pan-mode:active {
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
</style>
