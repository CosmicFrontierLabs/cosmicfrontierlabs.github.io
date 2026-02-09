<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { ThreePerf } from "three-perf";
  import { Telescope } from "./simulation/Telescope";
  import { ReactiveStarfield } from "./simulation/ReactiveStarfield";
  import { Earth } from "./simulation/Earth";
  import { simulationConfig } from "./simulation/simulationConfig";
  import { sampleArray, grid3d, GrainShader, MouseTracker } from "./simulation/simulationUtils";
  import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
  import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
  import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
  import { CarouselScene, carouselData } from "./simulation/CarouselScene";
  import gsap from "gsap";

  interface Props {
    activeScene?: "simulation" | "carousel" | "idle";
    canvasOpacity?: number;
    /** 0–1 scroll progress through the hero section, drives camera zoom */
    heroScrollProgress?: number;
  }

  let {
    activeScene = $bindable("simulation"),
    canvasOpacity = $bindable(1),
    heroScrollProgress = 0,
  }: Props = $props();

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

  // activeScene and canvasOpacity are controlled by the parent via bindable props

  // Carousel scene instance
  let carouselScene: CarouselScene | null = null;

  // Carousel state
  let curCarouselItemIndex = $state(0);
  let progress = $state(0);
  let autoplayInterval: ReturnType<typeof setTimeout> | null = null;
  let progressInterval: ReturnType<typeof setInterval> | null = null;
  const SLIDE_DURATION = 15000;
  const PROGRESS_UPDATE_INTERVAL = 50;
  let titleEl: HTMLHeadingElement;
  let descriptionEl: HTMLParagraphElement;

  // Frame tracking for initialization opacity
  const minFramesForReady = 100;
  let framesRendered = $state(0);
  let isReady = $derived(framesRendered > minFramesForReady);

  // Error boundary state
  let initError = $state<string | null>(null);
  let webglSupported = $state(true);

  // --- Carousel controls ---
  function startAutoplay() {
    stopAutoplay();
    progress = 0;
    let elapsed = 0;

    progressInterval = setInterval(() => {
      elapsed += PROGRESS_UPDATE_INTERVAL;
      progress = Math.min((elapsed / SLIDE_DURATION) * 100, 100);
    }, PROGRESS_UPDATE_INTERVAL);

    autoplayInterval = setTimeout(() => {
      goToNext();
    }, SLIDE_DURATION);
  }

  function stopAutoplay() {
    if (autoplayInterval) {
      clearTimeout(autoplayInterval);
      autoplayInterval = null;
    }
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
  }

  function goToIndex(index: number) {
    if (!carouselScene) return;
    if (index === curCarouselItemIndex) return;

    const nextItem = carouselData[index];
    carouselScene.enableCameraReaction = false;

    const tl = gsap.timeline();

    tl.to(titleEl, { opacity: 0, duration: 0.3 }, 0);
    tl.to(descriptionEl, { opacity: 0, duration: 0.3 }, 0);

    tl.call(
      () => {
        curCarouselItemIndex = index;
        carouselScene?.setActiveModel(index);
      },
      [],
      0.4,
    );

    tl.fromTo(titleEl, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);
    tl.fromTo(descriptionEl, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);

    const targetPos = new THREE.Vector3(nextItem.camera.position.x, nextItem.camera.position.y, nextItem.camera.position.z);
    const targetLookAt = new THREE.Vector3(nextItem.camera.lookAt.x, nextItem.camera.lookAt.y, nextItem.camera.lookAt.z);

    tl.add(carouselScene.animateCameraTo(targetPos, targetLookAt, 2.5), 0);

    startAutoplay();
  }

  function goToNext() {
    const nextIndex = (curCarouselItemIndex + 1) % carouselData.length;
    goToIndex(nextIndex);
  }

  function goToPrev() {
    const prevIndex = (curCarouselItemIndex - 1 + carouselData.length) % carouselData.length;
    goToIndex(prevIndex);
  }

  function handleCarouselMousemove(event: MouseEvent) {
    carouselScene?.updateMousePosition(event);
  }

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

  function startAnimationLoop(): () => void {
    if (!scene || !camera || !renderer || !telescopes || !earth || !reactiveStarfield) {
      return () => {};
    }

    const clock = new THREE.Clock();
    const telescopeOrigins: THREE.Vector3[] = new Array(telescopes.length);
    const telescopeTargets: THREE.Vector3[] = new Array(telescopes.length);

    function animate() {
      if (!scene || !camera || !renderer || !telescopes || !earth || !reactiveStarfield) {
        return;
      }
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      if (activeScene === "simulation") {
        // Update simulation scene
        if (mouseTracker && camera) {
          mouseTracker.update(camera);
        }

        const sphereCenter = new THREE.Vector3(0, 0, 0);
        const sphereRadius = simulationConfig.background.geometry.radius;
        const mouseWorldPosition = mouseTracker?.getIntersectionWithSphere(sphereCenter, sphereRadius) ?? sphereCenter;

        telescopes.forEach((telescope, i) => {
          telescope.update(elapsedTime, mouseWorldPosition);
          telescopeOrigins[i] = telescope.origin.clone();
          telescopeTargets[i] = telescope.target.clone();
        });

        earth.update(delta);
        camera.updateMatrixWorld();
        reactiveStarfield?.updateFrustums(telescopeOrigins, telescopeTargets, camera);

        if (perf) perf.begin();

        if (effectComposer && grainPass) {
          effectComposer.render();
        } else {
          renderer.render(scene, camera);
        }
      } else if (activeScene === "carousel" && carouselScene) {
        // Update and render carousel scene
        carouselScene.update(delta);

        if (perf) perf.begin();

        // Use tone mapping for carousel scene
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.0;
        renderer.render(carouselScene.scene, carouselScene.camera);
        // Reset tone mapping for simulation scene
        renderer.toneMapping = THREE.NoToneMapping;
      }

      framesRendered++;

      if (perf) perf.end();
    }

    animate();

    return () => {
      renderer?.dispose();
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
        1600,
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
      stopAutoplay();

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
    const zoomScaleFactor = 3.0;
    cameraFrustumSize = initialCameraFrustumSize - heroScrollProgress * zoomScaleFactor;
    updateCamera();
  });

  // Watch activeScene to start/stop carousel autoplay
  $effect(() => {
    if (activeScene === "carousel") {
      startAutoplay();
    } else {
      stopAutoplay();
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
  style="opacity: {isReady ? canvasOpacity : 0};"
></div>

<!-- Carousel overlay: only visible when carousel is active -->
{#if activeScene === "carousel"}
  <div class="carousel-overlay" onmousemove={handleCarouselMousemove} role="application" aria-label="3D model carousel">
    <div class="carousel-glass">
      <div class="description-wrapper">
        <h2 bind:this={titleEl}>{curCarouselItemIndex + 1}. {carouselData[curCarouselItemIndex].title}</h2>
        <p bind:this={descriptionEl}>{carouselData[curCarouselItemIndex].description}</p>
      </div>

      <div class="carousel-controls">
        <button class="nav-arrow" onclick={() => goToPrev()} aria-label="Previous slide">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="indicators">
          {#each carouselData as _, i}
            <button
              class="indicator"
              class:active={i === curCarouselItemIndex}
              onclick={() => goToIndex(i)}
              aria-label="Go to slide {i + 1}"
            >
              {#if i === curCarouselItemIndex}
                <div class="progress-fill" style="width: {progress}%"></div>
              {/if}
            </button>
          {/each}
        </div>
        <button class="nav-arrow" onclick={() => goToNext()} aria-label="Next slide">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  </div>
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

  /* Carousel overlay - fixed over the canvas, only shown when carousel is active */
  .carousel-overlay {
    position: fixed;
    inset: 0;
    z-index: 14;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: center;
    padding-block-end: 2%;
    padding-inline: 2rem;
    pointer-events: auto;
  }

  .carousel-glass {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding-block: 1rem;
  }

  .description-wrapper {
    padding: 2ch 2ch;
    font-size: 0.875rem;
    max-width: 60ch;
    min-height: 8lh;
  }

  .description-wrapper h2 {
    font-size: 1.325rem;
    text-wrap: balance;
    margin-block-start: 0lh;
    margin-block-end: 0.25lh;
  }

  .carousel-controls {
    margin-block: 1rem;
    padding-inline: 1rem;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .nav-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    cursor: pointer;
    color: currentColor;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.4);
    }
  }

  .indicators {
    display: flex;
    gap: 8px;
  }

  .indicator {
    position: relative;
    width: 24px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    border-radius: 2px;
    cursor: pointer;
    overflow: hidden;
    transition: background 0.2s ease;
    padding: 0;

    &:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    &.active {
      background: rgba(255, 255, 255, 0.3);
    }
  }

  .progress-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 2px;
    transition: width 0.05s linear;
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
