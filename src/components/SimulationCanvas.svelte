<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { ThreePerf } from "three-perf";
  import { Telescope } from "./simulation/Telescope";
  import { ReactiveStarfield } from "./simulation/ReactiveStarfield";
  import { Earth } from "./simulation/Earth";
  import { simulationConfig } from "./simulation/simulationConfig";
  import { sampleArray, grid3d } from "./simulation/mathUtils";
  import { GrainShader } from "./simulation/GrainShader";
  import { MouseTracker } from "./simulation/MouseTracker";
  import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
  import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
  import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
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

  // Orbit controls state — managed internally
  let orbitMode = $state(false);

  // Space key held (for pan cursor feedback)
  let spaceHeldForPan = $state(false);

  // Allow explore interactions only when carousel is visible and not already in orbit mode
  let allowExplore = $derived(activeScene === "carousel" && !orbitMode && canvasOpacity > 0);

  // Mouse cursor position for the "click to explore" circle
  let cursorX = $state(0);
  let cursorY = $state(0);
  let cursorOver = $state(false);
  let cursorVisible = $derived(allowExplore && cursorOver);

  let container: HTMLDivElement;
  let resizeObserver: ResizeObserver;
  let telescopes: Telescope[] = [];
  let earth: Earth | null = null;
  let reactiveStarfield: ReactiveStarfield | null = null;
  let perf: ThreePerf | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  const initialCameraFrustumSize = 3.0;
  let cameraFrustumSize = initialCameraFrustumSize;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let effectComposer: EffectComposer | null = null;
  let renderPass: RenderPass | null = null;
  let grainPass: ShaderPass | null = null;

  // Mouse position tracking
  let mouseTracker: MouseTracker | null = null;

  // Carousel scene instance (exposed to CarouselOverlay)
  let carouselScene = $state<CarouselScene | null>(null);

  // Frame tracking for initialization opacity — stops incrementing once ready
  const minFramesForReady = 100;
  let framesRendered = 0;
  let isReady = $state(false);

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

    if (scene && camera && newRenderer) {
      renderPass = new RenderPass(scene, camera);
      grainPass = new ShaderPass(GrainShader);
      grainPass.uniforms.uResolution.value.set(width, height);
      effectComposer = new EffectComposer(newRenderer);
      effectComposer.addPass(renderPass);
      effectComposer.addPass(grainPass);
    }

    return newRenderer;
  }

  function setupLighting(): void {
    if (!scene) return;
    const config = simulationConfig.lighting;
    const ambientLight = new THREE.AmbientLight(0xffffff, config.ambient.intensity);
    scene.add(ambientLight);
  }

  function setupResizeObserver(): ResizeObserver {
    // Track previous dimensions to ignore small height-only changes
    // caused by mobile browser chrome (iOS address bar show/hide)
    let prevWidth = container.offsetWidth || container.clientWidth;
    let prevHeight = container.offsetHeight || container.clientHeight;
    const mobileHeightThreshold = 150; // px — iOS chrome bar is typically ~50-100px

    const observer = new ResizeObserver((entries) => {
      if (camera && renderer && container) {
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

        updateCamera();
        renderer.setSize(width, height);
        reactiveStarfield?.setResolution(width, height);
        carouselScene?.resize(width, height);

        if (grainPass) {
          grainPass.uniforms.uResolution.value.set(width, height);
        }
        if (effectComposer) {
          effectComposer.setSize(width, height);
        }
      }
    });
    observer.observe(container);
    return observer;
  }

  function updateCamera(): void {
    if (camera && container) {
      const width = container.offsetWidth || container.clientWidth;
      const height = container.offsetHeight || container.clientHeight;
      const aspect = width && height ? width / height : 1;

      camera.left = (-cameraFrustumSize / 2) * aspect;
      camera.right = (cameraFrustumSize / 2) * aspect;
      camera.top = cameraFrustumSize / 2;
      camera.bottom = -cameraFrustumSize / 2;
      camera.updateProjectionMatrix();
    }
  }

  function handleContextLost(event: Event): void {
    event.preventDefault();
    initError = "WebGL context was lost. Please reload the page.";
  }

  function startAnimationLoop(): () => void {
    if (!scene || !camera || !renderer || !telescopes || !earth || !reactiveStarfield) {
      return () => {};
    }

    // Capture refs that don't change for the lifetime of the loop
    const loopScene = scene;
    const loopCamera = camera;
    const loopRenderer = renderer;
    const loopEarth = earth;
    const loopReactiveStarfield = reactiveStarfield;

    const clock = new THREE.Clock();
    const numTelescopes = telescopes.length;

    // Pre-allocate origin/target arrays with Vector3 instances (reused every frame)
    const telescopeOrigins: THREE.Vector3[] = new Array(numTelescopes);
    const telescopeTargets: THREE.Vector3[] = new Array(numTelescopes);
    for (let i = 0; i < numTelescopes; i++) {
      telescopeOrigins[i] = new THREE.Vector3();
      telescopeTargets[i] = new THREE.Vector3();
    }

    // Pre-allocate reusable objects to avoid per-frame GC pressure
    const sphereCenter = new THREE.Vector3(0, 0, 0);
    const sphereRadius = simulationConfig.background.geometry.radius;
    const mouseWorldPosition = new THREE.Vector3();

    let rafId: number;

    function animate() {
      rafId = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Read activeScene from the reactive prop on each frame
      // (captured via the outer closure over the $props binding)
      if (activeScene === "simulation") {
        if (mouseTracker && loopCamera) {
          mouseTracker.update(loopCamera);
        }

        if (mouseTracker) {
          mouseTracker.getIntersectionWithSphere(sphereCenter, sphereRadius, mouseWorldPosition);
        } else {
          mouseWorldPosition.copy(sphereCenter);
        }

        for (let i = 0; i < numTelescopes; i++) {
          telescopes[i].update(elapsedTime, mouseWorldPosition);
          telescopeOrigins[i].copy(telescopes[i].origin);
          telescopeTargets[i].copy(telescopes[i].target);
        }

        loopEarth.update(delta);
        loopCamera.updateMatrixWorld();
        loopReactiveStarfield.updateFrustums(telescopeOrigins, telescopeTargets, loopCamera);

        if (perf) perf.begin();

        if (effectComposer && grainPass) {
          effectComposer.render();
        } else {
          loopRenderer.render(loopScene, loopCamera);
        }
      } else if (activeScene === "carousel" && carouselScene) {
        carouselScene.update(delta);

        if (perf) perf.begin();

        loopRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        loopRenderer.toneMappingExposure = 1.0;
        loopRenderer.render(carouselScene.scene, carouselScene.camera);
        loopRenderer.toneMapping = THREE.NoToneMapping;
      }

      // Stop incrementing once ready to avoid reactive churn
      if (!isReady) {
        framesRendered++;
        if (framesRendered > minFramesForReady) {
          isReady = true;
        }
      }

      if (perf) perf.end();
    }

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      loopRenderer.dispose();
    };
  }

  onMount(() => {
    if (!checkWebGLSupport()) {
      webglSupported = false;
      initError =
        "WebGL is not supported in your browser. Please try a modern browser like Chrome, Firefox, or Safari.";
      return;
    }

    let cleanupAnimation: (() => void) | null = null;
    let handleMouseMove: ((event: MouseEvent) => void) | null = null;
    let handleMouseClick: ((event: MouseEvent) => void) | null = null;
    let handleCursorEnter: (() => void) | null = null;
    let handleCursorLeave: (() => void) | null = null;

    try {
      const config = simulationConfig;
      scene = new THREE.Scene();
      scene.background = null;

      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
      camera.position.set(0, 0, 300);
      camera.lookAt(new THREE.Vector3(0, 0, 0));
      updateCamera();

      renderer = createRenderer(container);
      renderer.setClearColor(0x000000, 0);

      // Listen for WebGL context loss (#20)
      renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

      if (config.perf.enabled) {
        perf = new ThreePerf({
          anchorX: "left",
          anchorY: "top",
          domElement: container,
          renderer: renderer,
        });
      }

      setupLighting();

      const width = container.offsetWidth || container.clientWidth;
      const height = container.offsetHeight || container.clientHeight;
      reactiveStarfield = new ReactiveStarfield(scene, width, height, renderer);
      earth = new Earth(scene, renderer);

      // Set up telescopes
      const originGridPoints: THREE.Vector3[] = grid3d(
        simulationConfig.earth.position,
        simulationConfig.earth.radius * simulationConfig.telescope.orbitalRadiusScalar,
        1600
      );
      const origins = sampleArray(originGridPoints, simulationConfig.telescope.numTelescopes);
      const numMouseTrackingTelescopes = simulationConfig.telescope.numMouseTrackingTelescopes;
      telescopes = origins.map((origin, index) => {
        const shouldTrackMouse = index < numMouseTrackingTelescopes;
        if (!scene) throw new Error("Scene not initialized");
        return new Telescope(scene, origin, shouldTrackMouse);
      });

      mouseTracker = new MouseTracker();
      camera.updateMatrixWorld();

      // Carousel scene is created lazily when first needed (see $effect below)

      resizeObserver = setupResizeObserver();
      cleanupAnimation = startAnimationLoop();

      // Mouse tracking (also drives explore cursor position)
      handleMouseMove = (event: MouseEvent) => {
        if (container && mouseTracker) {
          const rect = container.getBoundingClientRect();
          const w = container.offsetWidth || container.clientWidth;
          const h = container.offsetHeight || container.clientHeight;
          const x = ((event.clientX - rect.left) / w) * 2 - 1;
          const y = -((event.clientY - rect.top) / h) * 2 + 1;
          mouseTracker.updateMousePositionNDC(x, y);
        }

        // Update explore cursor position when in carousel mode
        if (allowExplore) {
          cursorX = event.clientX;
          cursorY = event.clientY;
          cursorOver = true;
        }
      };
      container.addEventListener("mousemove", handleMouseMove);

      handleMouseClick = (event: MouseEvent) => {
        if (container && mouseTracker && camera) {
          const rect = container.getBoundingClientRect();
          const w = container.offsetWidth || container.clientWidth;
          const h = container.offsetHeight || container.clientHeight;
          const x = ((event.clientX - rect.left) / w) * 2 - 1;
          const y = -((event.clientY - rect.top) / h) * 2 + 1;
          mouseTracker.updateMousePositionNDC(x, y);
          mouseTracker.update(camera);
        }
      };
      container.addEventListener("click", handleMouseClick);

      // Carousel cursor visibility tracking
      handleCursorEnter = () => {
        cursorOver = true;
      };
      handleCursorLeave = () => {
        cursorOver = false;
      };
      container.addEventListener("mouseenter", handleCursorEnter);
      container.addEventListener("mouseleave", handleCursorLeave);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Simulation initialization failed:", error);
      initError = `Failed to initialize 3D simulation: ${errorMessage}`;
      return;
    }

    return () => {
      resizeObserver?.disconnect();
      if (handleMouseMove) container.removeEventListener("mousemove", handleMouseMove);
      if (handleMouseClick) container.removeEventListener("click", handleMouseClick);
      if (handleCursorEnter) container.removeEventListener("mouseenter", handleCursorEnter);
      if (handleCursorLeave) container.removeEventListener("mouseleave", handleCursorLeave);
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      }

      telescopes.forEach((telescope) => telescope.dispose());
      telescopes = [];
      Telescope.disposeStaticResources();

      earth?.dispose();
      reactiveStarfield?.dispose();
      carouselScene?.dispose();
      perf?.dispose();
      cleanupAnimation?.();
    };
  });

  // Lazily initialize the carousel scene when the user first scrolls to it
  $effect(() => {
    if (activeScene === "carousel" && !carouselScene && renderer && container) {
      const width = container.offsetWidth || container.clientWidth;
      const height = container.offsetHeight || container.clientHeight;
      carouselScene = new CarouselScene(width, height, renderer);
    }
  });

  // Sync orbit controls toggle to carousel scene and wire up pan callback
  $effect(() => {
    if (carouselScene) {
      carouselScene.enableOrbitControls = orbitMode;
      carouselScene.onSpaceHeldChange = (held: boolean) => {
        spaceHeldForPan = held;
      };
    }
  });

  // Reset orbit mode when leaving carousel
  $effect(() => {
    if (activeScene !== "carousel") {
      orbitMode = false;
      cursorOver = false;
      spaceHeldForPan = false;
      carouselScene?.resetPan();
    }
  });

  // Reset pan when exiting orbit mode
  $effect(() => {
    if (!orbitMode && carouselScene) {
      carouselScene.resetPan();
      spaceHeldForPan = false;
    }
  });

  // Drive camera zoom from hero scroll progress
  $effect(() => {
    const zoomScaleFactor = 1.5;
    cameraFrustumSize = initialCameraFrustumSize - heroScrollProgress * zoomScaleFactor;
    updateCamera();
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
  class="simulation-viewer"
  class:ready={isReady}
  class:carousel-active={activeScene === "carousel"}
  class:allow-explore={allowExplore}
  class:orbit-mode={orbitMode}
  class:pan-mode={orbitMode && spaceHeldForPan}
  style="opacity: {canvasOpacity};"
  onclick={() => {
    if (allowExplore) {
      orbitMode = true;
    }
  }}
  onkeydown={(e) => {
    if ((e.key === "Enter" || e.key === " ") && allowExplore) {
      e.preventDefault();
      orbitMode = true;
    }
  }}
  role="button"
  tabindex="-1"
></div>

{#if cursorVisible}
  <div
    class="explore-cursor"
    style="transform: translate(calc({cursorX}px - 50%), calc({cursorY}px - 50%));"
  >
    <svg class="explore-cursor__ring" width="80" height="80" viewBox="0 0 80 80">
      <circle cx="40" cy="40" r="38" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1" />
      <circle cx="40" cy="40" r="38" fill="none" stroke="rgba(255,255,255,0.8)" stroke-width="1.5"
        stroke-dasharray="60 180" stroke-dashoffset="0" class="explore-cursor__arc" />
    </svg>
    <span class="explore-cursor__label">Click to<br/>explore</span>
  </div>
{/if}

<div style="opacity: {canvasOpacity * (activeScene === 'carousel' ? 1 : 0)};">
  <CarouselOverlay {carouselScene} paused={orbitMode} onExitOrbit={() => { orbitMode = false; }} />
</div>

<style>
  .simulation-viewer {
    position: fixed;
    inset: 0;
    background-color: var(--body-bg);
    transition: opacity 0.3s ease-in;
    z-index: 1;
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
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
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
</style>
