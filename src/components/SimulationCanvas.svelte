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
    activeScene: "simulation" | "carousel" | "idle";
    canvasOpacity: number;
    /** 0–1 scroll progress through the hero section, drives camera zoom */
    heroScrollProgress: number;
    /** 0–1 opacity for carousel UI (text + controls), driven by scroll */
    carouselUIOpacity: number;
  }

  let { activeScene, canvasOpacity, heroScrollProgress, carouselUIOpacity }: Props = $props();

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

  // Frame tracking for initialization opacity
  const minFramesForReady = 100;
  let framesRendered = $state(0);
  let isReady = $derived(framesRendered > minFramesForReady);

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
    const observer = new ResizeObserver((entries) => {
      if (camera && renderer && container) {
        const entry = entries[0];
        const width = entry.contentRect.width || entry.borderBoxSize[0]?.inlineSize || container.clientWidth;
        const height = entry.contentRect.height || entry.borderBoxSize[0]?.blockSize || container.clientHeight;

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
    const telescopeOrigins: THREE.Vector3[] = new Array(telescopes.length);
    const telescopeTargets: THREE.Vector3[] = new Array(telescopes.length);

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

        const sphereCenter = new THREE.Vector3(0, 0, 0);
        const sphereRadius = simulationConfig.background.geometry.radius;
        const mouseWorldPosition = mouseTracker?.getIntersectionWithSphere(sphereCenter, sphereRadius) ?? sphereCenter;

        telescopes.forEach((telescope, i) => {
          telescope.update(elapsedTime, mouseWorldPosition);
          telescopeOrigins[i] = telescope.origin.clone();
          telescopeTargets[i] = telescope.target.clone();
        });

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

      framesRendered++;

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
      initError = "WebGL is not supported in your browser. Please try a modern browser like Chrome, Firefox, or Safari.";
      return;
    }

    let cleanupAnimation: (() => void) | null = null;
    let handleMouseMove: ((event: MouseEvent) => void) | null = null;
    let handleMouseClick: ((event: MouseEvent) => void) | null = null;

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

      // Initialize carousel scene (shares the same renderer)
      carouselScene = new CarouselScene(width, height, renderer);

      resizeObserver = setupResizeObserver();
      cleanupAnimation = startAnimationLoop();

      // Mouse tracking
      handleMouseMove = (event: MouseEvent) => {
        if (container && mouseTracker) {
          const rect = container.getBoundingClientRect();
          const w = container.offsetWidth || container.clientWidth;
          const h = container.offsetHeight || container.clientHeight;
          const x = ((event.clientX - rect.left) / w) * 2 - 1;
          const y = -((event.clientY - rect.top) / h) * 2 + 1;
          mouseTracker.updateMousePositionNDC(x, y);
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

  // Drive camera zoom from hero scroll progress
  $effect(() => {
    const zoomScaleFactor = 1.5;
    cameraFrustumSize = initialCameraFrustumSize - heroScrollProgress * zoomScaleFactor;
    updateCamera();
  });

  // Drive carousel introMode based on UI opacity
  $effect(() => {
    if (carouselScene) {
      const uiVisible = carouselUIOpacity > 0.8;
      carouselScene.introMode = !uiVisible;
      carouselScene.enableCameraReaction = uiVisible;
    }
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
  style="opacity: {canvasOpacity};"
></div>

<!-- Carousel overlay: only visible when carousel is active and UI has faded in -->
{#if activeScene === "carousel"}
  <CarouselOverlay {canvasOpacity} {carouselUIOpacity} {carouselScene} />
{/if}

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
