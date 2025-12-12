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
  import gsap from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";


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

  // Camera rotation state
  let cameraSpherical: THREE.Spherical | null = null;
  let targetSpherical: THREE.Spherical | null = null;
  let userInteracting: boolean = false;
  let lastInteractionTime: number = 0;
  let cameraRotationStartTime: number = 0;

  // Mouse position tracking
  let mouseTracker: MouseTracker | null = null;

  // Frame tracking for initialization opacity
  // minFrameForReady is really big, but it seemed good to make sure things are ready
  const minFramesForReady = 100; 
  let framesRendered = $state(0);
  let isReady = $derived(framesRendered > minFramesForReady);

  function createRenderer(container: HTMLDivElement): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    // 2.0 because this improves the quality of the grid lines
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    // Use offsetWidth/offsetHeight to get the actual rendered size
    const width = container.offsetWidth || container.clientWidth;
    const height = container.offsetHeight || container.clientHeight;
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    if (scene && camera && renderer) {
      // Add post-processing effects
      renderPass = new RenderPass(scene, camera);

      grainPass = new ShaderPass(GrainShader);
      grainPass.uniforms.uResolution.value.set(width, height);

      // Note: no bloom pass because it doesn't respect the transparent background
      effectComposer = new EffectComposer(renderer);
      effectComposer.addPass(renderPass);
      effectComposer.addPass(grainPass);
    } else {
      console.error("Post-processing effects not initialized");
    }

    return renderer;
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
        // Get the actual rendered size from the entry
        const entry = entries[0];
        const width = entry.contentRect.width || entry.borderBoxSize[0]?.inlineSize || container.clientWidth;
        const height = entry.contentRect.height || entry.borderBoxSize[0]?.blockSize || container.clientHeight;

        updateCamera();
        renderer.setSize(width, height);
        reactiveStarfield?.setResolution(width, height);

        // Update grain shader resolution
        if (grainPass) {
          grainPass.uniforms.uResolution.value.set(width, height);
        }

        // Update effect composer size
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
      return () => {
        console.error("Animation loop not initialized");
      };
    }

    const clock = new THREE.Clock();

    // Pre-allocate arrays to reuse each frame (avoid per-frame allocations)
    // Origins now change each frame as they orbit Earth
    // Targets change each frame, so we update references
    const telescopeOrigins: THREE.Vector3[] = new Array(telescopes.length);
    const telescopeTargets: THREE.Vector3[] = new Array(telescopes.length);

    function animate() {
      if (!scene || !camera || !renderer || !telescopes || !earth || !reactiveStarfield) {
        return () => {
          console.error("Animation loop not initialized");
        };
      }
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Update mouse tracker with current camera
      if (mouseTracker && camera) {
        mouseTracker.update(camera);
      }

      // Use mouse tracker to get the world position where the mouse intersects with the background sphere
      const sphereCenter = new THREE.Vector3(0, 0, 0);
      const sphereRadius = simulationConfig.background.geometry.radius;
      const mouseWorldPosition = mouseTracker?.getIntersectionWithSphere(sphereCenter, sphereRadius) ?? sphereCenter;

      telescopes.forEach((telescope, i) => {
        // Pass mouseWorldPosition to telescopes that track the mouse
        telescope.update(elapsedTime, mouseWorldPosition);
        telescopeOrigins[i] = telescope.origin.clone();
        telescopeTargets[i] = telescope.target.clone();
      });

      earth.update(delta);
      camera.updateMatrixWorld();

      reactiveStarfield?.updateFrustums(telescopeOrigins, telescopeTargets, camera);

      if (perf) {
        perf.begin();
      }

      if (effectComposer && grainPass) {
        effectComposer.render();
      } else {
        renderer.render(scene, camera);
      }

      // Increment frame counter after successful render
      framesRendered++;

      if (perf) {
        perf.end();
      }
    }

    animate();

    return () => {
      renderer?.dispose();
    };
  }

  onMount(() => {
    gsap.registerPlugin(ScrollTrigger);

    const config = simulationConfig;
    scene = new THREE.Scene();
    scene.background = null;

    // Initialize orthographic camera with proper aspect ratio
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    camera.position.set(0, 0, 300);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    updateCamera(); // Set initial aspect ratio

    renderer = createRenderer(container);
    renderer.setClearColor(0x000000, 0); // Transparent background

    if (perf && config.perf.enabled) {
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

    // Create telescopes with 25% randomly selected to track the mouse
    const numMouseTrackingTelescopes = simulationConfig.telescope.numMouseTrackingTelescopes;
    telescopes = origins.map((origin, index) => {
      const shouldTrackMouse = index < numMouseTrackingTelescopes;
      if (!scene) {
        throw new Error("Scene not initialized");
      }
      return new Telescope(scene, origin, shouldTrackMouse);
    });

    // Initialize mouse tracker
    mouseTracker = new MouseTracker();

    camera.updateMatrixWorld();

    // Set up scroll-based camera zoom
    const scrollTriggerInstance = ScrollTrigger.create({
      start: "top top",
      end: "bottom top",
      scrub: true,
      onUpdate: (self) => {
        // Animate cameraFrustumSize from initialCameraFrustumSize to 0.5 as user scrolls
        const zoomScaleFactor = 3.0;
        cameraFrustumSize = initialCameraFrustumSize - self.progress * zoomScaleFactor;
        updateCamera();
      },
    });

    resizeObserver = setupResizeObserver();
    const cleanupAnimation = startAnimationLoop();

    // Set up mouse position tracking
    const handleMouseMove = (event: MouseEvent) => {
      if (container && mouseTracker) {
        const rect = container.getBoundingClientRect();
        const width = container.offsetWidth || container.clientWidth;
        const height = container.offsetHeight || container.clientHeight;
        const x = ((event.clientX - rect.left) / width) * 2 - 1;
        const y = -((event.clientY - rect.top) / height) * 2 + 1;
        mouseTracker.updateMousePositionNDC(x, y);
      }
    };
    container.addEventListener("mousemove", handleMouseMove);

    // Set up mouse click tracking for debug point
    const handleMouseClick = (event: MouseEvent) => {
      if (container && mouseTracker && camera) {
        const rect = container.getBoundingClientRect();
        const width = container.offsetWidth || container.clientWidth;
        const height = container.offsetHeight || container.clientHeight;
        const x = ((event.clientX - rect.left) / width) * 2 - 1;
        const y = -((event.clientY - rect.top) / height) * 2 + 1;
        mouseTracker.updateMousePositionNDC(x, y);
        mouseTracker.update(camera);
      }
    };
    container.addEventListener("click", handleMouseClick);

    return () => {
      resizeObserver?.disconnect();
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("click", handleMouseClick);
      scrollTriggerInstance?.kill();
      earth?.dispose();
      perf?.dispose();
      cleanupAnimation();
    };
  });
</script>

<div bind:this={container} class="simulation-viewer" class:ready={isReady}></div>

<style>
  .simulation-viewer {
    position: absolute;
    inset: 0;
    background-color: var(--body-bg);
    opacity: 0;
    transition: opacity 0.3s ease-in;
  }

  .simulation-viewer.ready {
    opacity: 1;
  }
</style>
