import * as THREE from "three";
import { Telescope } from "./Telescope";
import { ReactiveStarfield } from "./ReactiveStarfield";
import { Earth } from "./Earth";
import { simulationConfig } from "./simulationConfig";
import { sampleArray, grid3d } from "./mathUtils";
import { GrainShader } from "./GrainShader";
import { MouseTracker } from "./MouseTracker";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

/**
 * EarthScene manages the 3D earth/telescope/starfield simulation scene.
 * It does NOT own a renderer — it renders into a shared renderer passed to it.
 */
export class EarthScene {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;

  private renderer: THREE.WebGLRenderer;
  private earth: Earth;
  private telescopes: Telescope[];
  private reactiveStarfield: ReactiveStarfield;
  private mouseTracker: MouseTracker;
  private effectComposer: EffectComposer;
  private renderPass: RenderPass;
  private grainPass: ShaderPass;

  private readonly initialCameraFrustumSize = 3.0;
  private cameraFrustumSize: number;

  // Pre-allocated objects to avoid per-frame GC pressure
  private readonly telescopeOrigins: THREE.Vector3[];
  private readonly telescopeTargets: THREE.Vector3[];
  private readonly sphereCenter = new THREE.Vector3(0, 0, 0);
  private readonly sphereRadius = simulationConfig.background.geometry.radius;
  private readonly mouseWorldPosition = new THREE.Vector3();

  private disposed = false;

  constructor(width: number, height: number, renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.cameraFrustumSize = this.initialCameraFrustumSize;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = null;

    // Orthographic camera
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.camera.position.set(0, 0, 300);
    this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    this.updateCamera(width, height);

    // Lighting
    const config = simulationConfig.lighting;
    const ambientLight = new THREE.AmbientLight(0xffffff, config.ambient.intensity);
    this.scene.add(ambientLight);

    // Starfield
    this.reactiveStarfield = new ReactiveStarfield(this.scene, width, height, renderer);

    // Earth
    this.earth = new Earth(this.scene, renderer);

    // Telescopes
    const originGridPoints: THREE.Vector3[] = grid3d(
      simulationConfig.earth.position,
      simulationConfig.earth.radius * simulationConfig.telescope.orbitalRadiusScalar,
      1600,
    );
    const origins = sampleArray(originGridPoints, simulationConfig.telescope.numTelescopes);
    const numMouseTrackingTelescopes = simulationConfig.telescope.numMouseTrackingTelescopes;
    this.telescopes = origins.map((origin, index) => {
      const shouldTrackMouse = index < numMouseTrackingTelescopes;
      return new Telescope(this.scene, origin, shouldTrackMouse);
    });

    // Pre-allocate origin/target arrays
    const numTelescopes = this.telescopes.length;
    this.telescopeOrigins = new Array(numTelescopes);
    this.telescopeTargets = new Array(numTelescopes);
    for (let i = 0; i < numTelescopes; i++) {
      this.telescopeOrigins[i] = new THREE.Vector3();
      this.telescopeTargets[i] = new THREE.Vector3();
    }

    // Mouse tracker
    this.mouseTracker = new MouseTracker();
    this.camera.updateMatrixWorld();

    // Post-processing
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.grainPass = new ShaderPass(GrainShader);
    this.grainPass.uniforms.uResolution.value.set(width, height);
    this.effectComposer = new EffectComposer(renderer);
    this.effectComposer.addPass(this.renderPass);
    this.effectComposer.addPass(this.grainPass);
  }

  /** Update the orthographic camera frustum for the given viewport dimensions. */
  updateCamera(width: number, height: number): void {
    const aspect = width && height ? width / height : 1;
    this.camera.left = (-this.cameraFrustumSize / 2) * aspect;
    this.camera.right = (this.cameraFrustumSize / 2) * aspect;
    this.camera.top = this.cameraFrustumSize / 2;
    this.camera.bottom = -this.cameraFrustumSize / 2;
    this.camera.updateProjectionMatrix();
  }

  /** Set the camera zoom based on hero scroll progress (0–1). */
  setHeroScrollProgress(progress: number): void {
    const zoomScaleFactor = 1.5;
    this.cameraFrustumSize = this.initialCameraFrustumSize - progress * zoomScaleFactor;
  }

  /** Handle viewport resize. */
  resize(width: number, height: number): void {
    this.updateCamera(width, height);
    this.reactiveStarfield.setResolution(width, height);
    this.grainPass.uniforms.uResolution.value.set(width, height);
    this.effectComposer.setSize(width, height);
  }

  /** Update mouse position in NDC coordinates. */
  updateMouseNDC(x: number, y: number): void {
    this.mouseTracker.updateMousePositionNDC(x, y);
  }

  /** Force a mouse tracker update (e.g. on click). */
  updateMouseTracker(): void {
    this.mouseTracker.update(this.camera);
  }

  /** Run one frame of the simulation. */
  update(delta: number, elapsedTime: number): void {
    if (this.disposed) return;

    this.mouseTracker.update(this.camera);
    this.mouseTracker.getIntersectionWithSphere(
      this.sphereCenter,
      this.sphereRadius,
      this.mouseWorldPosition,
    );

    const numTelescopes = this.telescopes.length;
    for (let i = 0; i < numTelescopes; i++) {
      this.telescopes[i].update(elapsedTime, this.mouseWorldPosition);
      this.telescopeOrigins[i].copy(this.telescopes[i].origin);
      this.telescopeTargets[i].copy(this.telescopes[i].target);
    }

    this.earth.update(delta);
    this.camera.updateMatrixWorld();
    this.reactiveStarfield.updateFrustums(
      this.telescopeOrigins,
      this.telescopeTargets,
      this.camera,
    );
  }

  /** Render the scene using the effect composer (with grain post-processing). */
  render(): void {
    if (this.disposed) return;
    this.effectComposer.render();
  }

  /** Dispose all resources. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.telescopes.forEach((telescope) => telescope.dispose());
    this.telescopes = [];
    Telescope.disposeStaticResources();

    this.earth.dispose();
    this.reactiveStarfield.dispose();
  }
}
