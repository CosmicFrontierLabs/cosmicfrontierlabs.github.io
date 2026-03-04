import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { GUI } from "three/examples/jsm/libs/lil-gui.module.min.js";
import {
  cloneMaterialsPerMesh,
  enhanceMetallicMaterials,
  defaultMetallicParams,
  type MetallicEnhanceParams,
} from "./materialUtils";
import type { CarouselItem, ModelConfig } from "$lib/types";
import gsap from "gsap";

/** Maximum reflector render target dimension to limit GPU cost on high-DPI displays. */
const MAX_REFLECTOR_SIZE = 2048;

const DEFAULT_CAMERA = {
  position: { x: 3, y: 1.5, z: 3 },
  lookAt: { x: 0, y: 0.5, z: 0 },
};

/**
 * Registry of all loadable models. Each entry's `name` matches the `model`
 * field in carousel.yaml. To add a new model: add an entry here, then use
 * the name as the `model` value in carousel.yaml slides.
 */
export const MODEL_CONFIGS: ModelConfig[] = [
  {
    name: "payload",
    url: "/models/20260102_Payload_assy_no_baffle.glb",
    scale: 5.0,
    brighten: true,
    mirrorMeshName: "mesh_0_55",
  },
];

/**
 * CarouselScene manages the 3D carousel scene (models, lights, camera, rings).
 * It does NOT own a renderer—it renders into a shared renderer passed to it.
 */
export class CarouselScene {
  enableOrbitControls: boolean = false;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Loaded model groups, keyed by MODEL_CONFIGS key (e.g. "payload"). */
  private models = new Map<string, THREE.Group>();
  private ambientLight: THREE.AmbientLight;
  private keyLight: THREE.RectAreaLight;
  private rimLight: THREE.PointLight;
  private renderer: THREE.WebGLRenderer;
  private mirrorReflector: Reflector | null = null;
  private mirrorDiskGeometry: THREE.BufferGeometry | null = null;
  private mirrorRimGeometry: THREE.TorusGeometry | null = null;
  private mirrorRimMaterial: THREE.MeshStandardMaterial | null = null;
  private backgroundTexture: THREE.Texture | null = null;
  private disposed = false;
  private orbitControls: OrbitControls;
  private dracoLoader: DRACOLoader;
  private activeCameraTween: gsap.core.Tween | null = null;
  private gui: GUI;
  private metallicParams: MetallicEnhanceParams;
  /** Mesh names to skip when enhancing materials (e.g. mirror). */
  private materialSkipNames = new Set<string>();

  /** Tracks the current lookAt target for smooth camera transitions */
  private currentLookAtTarget = new THREE.Vector3(0, 0, 0);

  // --- Pan state ---
  /** Whether the space key is currently held down */
  private spaceHeld = false;
  /** Whether a pan drag is in progress */
  private isPanning = false;
  /** Mouse position at pan drag start (screen pixels) */
  private panStartMouse = new THREE.Vector2();
  /** Orbit target at pan drag start */
  private panStartTarget = new THREE.Vector3();
  /** Camera position at pan drag start */
  private panStartCameraPos = new THREE.Vector3();
  /** Accumulated pan offset from the base orbit target */
  private panOffset = new THREE.Vector3();
  /** Callback fired when space-held state changes (for cursor feedback) */
  onShiftHeldChange: ((held: boolean) => void) | null = null;
  /** Whether the mouse is currently over the canvas */
  private mouseOverCanvas = false;

  // Pre-allocated vectors for pan math (avoid allocations in hot path)
  private readonly _panRight = new THREE.Vector3();
  private readonly _panUp = new THREE.Vector3();
  private readonly _panDelta = new THREE.Vector3();
  private readonly _panNewTarget = new THREE.Vector3();
  private readonly _panNewCameraPos = new THREE.Vector3();
  private readonly _panBaseTarget = new THREE.Vector3();

  // Bound event handlers for cleanup
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnPointerDown: (e: PointerEvent) => void;
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: (e: PointerEvent) => void;
  private boundOnMouseEnter: () => void;
  private boundOnMouseLeave: () => void;

  /** Carousel slide data (titles, camera positions, model references). */
  readonly carouselData: CarouselItem[];

  /** Resolves when all async assets (models, images) have finished loading. */
  readonly loaded: Promise<void>;

  constructor(width: number, height: number, renderer: THREE.WebGLRenderer, carouselData: CarouselItem[]) {
    RectAreaLightUniformsLib.init();
    this.carouselData = carouselData;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03060b); // Same as var(--body-bg)

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 50);
    const initialCamera = this.carouselData[0]?.camera ?? DEFAULT_CAMERA;
    this.camera.position.set(initialCamera.position.x, initialCamera.position.y, initialCamera.position.z);
    this.camera.lookAt(initialCamera.lookAt.x, initialCamera.lookAt.y, initialCamera.lookAt.z);
    this.currentLookAtTarget.set(initialCamera.lookAt.x, initialCamera.lookAt.y, initialCamera.lookAt.z);

    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(this.ambientLight);

    // Key light - warm neutral RectAreaLight for soft fill (simulates workshop overhead)
    this.keyLight = new THREE.RectAreaLight(0xfff0e0, 2.5, 5, 5);
    this.keyLight.position.set(3, 4, 5);
    this.keyLight.lookAt(0, 0, 0);
    this.scene.add(this.keyLight);

    // Rim light - subtle warm edge highlight
    this.rimLight = new THREE.PointLight(0xffaa70, 10.0, 20, 2);
    this.rimLight.position.set(-3, 2, -2);
    this.scene.add(this.rimLight);

    // Fog
    this.scene.fog = new THREE.Fog(0x0a1428, 5.0, 30.0);

    // Orbit controls — construct with the DOM element so it knows the
    // target, then immediately disconnect so its pointer listeners don't
    // block touch scrolling.  We reconnect in update() when orbit mode
    // is actually enabled.
    this.orbitControls = new OrbitControls(this.camera, renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;
    this.orbitControls.enablePan = false;
    this.orbitControls.target.copy(this.currentLookAtTarget);
    // Disconnect immediately — listeners will be re-added when orbit mode activates
    this.orbitControls.disconnect();
    this.orbitControls.enabled = false;
    // Re-apply lookAt after OrbitControls construction — its constructor
    // internally calls update() with default target (0,0,0), which can
    // modify the camera rotation before we set the correct target above.
    this.camera.lookAt(initialCamera.lookAt.x, initialCamera.lookAt.y, initialCamera.lookAt.z);

    // --- Pan event listeners ---
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    this.boundOnPointerDown = this.onPanPointerDown.bind(this);
    this.boundOnPointerMove = this.onPanPointerMove.bind(this);
    this.boundOnPointerUp = this.onPanPointerUp.bind(this);
    this.boundOnMouseEnter = () => {
      this.mouseOverCanvas = true;
    };
    this.boundOnMouseLeave = () => {
      this.mouseOverCanvas = false;
    };

    window.addEventListener("keydown", this.boundOnKeyDown);
    window.addEventListener("keyup", this.boundOnKeyUp);
    renderer.domElement.addEventListener("pointerdown", this.boundOnPointerDown);
    window.addEventListener("pointermove", this.boundOnPointerMove);
    window.addEventListener("pointerup", this.boundOnPointerUp);
    renderer.domElement.addEventListener("mouseenter", this.boundOnMouseEnter);
    renderer.domElement.addEventListener("mouseleave", this.boundOnMouseLeave);

    // --- Debug GUI for metallic material parameters ---
    this.metallicParams = { ...defaultMetallicParams };
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    this.gui = new GUI({ title: "Metallic Materials" });
    if (!isLocalhost) {
      this.gui.hide();
    }
    this.gui.hide(); // also hiding on localhost for now

    const reapply = () => this.reapplyMetallicParams();

    const metalFolder = this.gui.addFolder("Metalness");
    metalFolder.add(this.metallicParams, "minMetalness", 0, 1, 0.01).name("Min Metalness").onChange(reapply);
    metalFolder
      .add(this.metallicParams, "dielectricMetalness", 0, 1, 0.01)
      .name("Dielectric Metalness")
      .onChange(reapply);
    metalFolder.add(this.metallicParams, "metallicThreshold", 0, 1, 0.01).name("Metallic Threshold").onChange(reapply);

    const roughFolder = this.gui.addFolder("Roughness");
    roughFolder.add(this.metallicParams, "maxRoughness", 0, 1, 0.01).name("Max Roughness").onChange(reapply);
    roughFolder.add(this.metallicParams, "brushedMetalRoughness", 0, 1, 0.01).name("Brushed Metal").onChange(reapply);

    const colorFolder = this.gui.addFolder("Color / Emissive");
    colorFolder.add(this.metallicParams, "minLuminance", 0, 0.5, 0.01).name("Min Luminance").onChange(reapply);
    colorFolder.add(this.metallicParams, "maxBoostFactor", 1, 10, 0.5).name("Max Boost").onChange(reapply);
    colorFolder.add(this.metallicParams, "emissiveBoost", 0, 0.2, 0.005).name("Emissive Boost").onChange(reapply);

    const envFolder = this.gui.addFolder("Environment");
    envFolder
      .add(this.metallicParams, "envMapIntensity", 0, 3, 0.05)
      .name("Env Intensity")
      .onChange((v: number) => {
        this.scene.environmentIntensity = v;
      });

    // Loaders
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("/draco/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(this.dracoLoader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    this.loaded = (async () => {
      // Load all models from MODEL_CONFIGS in parallel with the background texture
      const modelPromises = MODEL_CONFIGS.map((cfg) => this.loadModel(gltfLoader, cfg));
      const texturePromise = new Promise<THREE.Texture>((resolve) => {
        new THREE.TextureLoader().load("/textures/carousel-bg.jpg", resolve);
      });

      const [texture, ...loadedModels] = await Promise.all([texturePromise, ...modelPromises]);

      if (this.disposed) {
        texture.dispose();
        return;
      }

      // Store loaded groups keyed by config name; hide all initially
      for (let i = 0; i < MODEL_CONFIGS.length; i++) {
        const group = loadedModels[i];
        group.visible = false;
        this.models.set(MODEL_CONFIGS[i].name, group);
      }
      // Show the first slide model, or fall back to the first configured model
      // so explore mode still has something to interact with when slide data is empty.
      const firstModelKey = this.carouselData[0]?.model ?? MODEL_CONFIGS[0]?.name;
      const firstModel = firstModelKey ? this.models.get(firstModelKey) : null;
      if (firstModel) firstModel.visible = true;

      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.backgroundTexture = texture;
      this.scene.background = texture;
    })();
  }

  /**
   * Load a GLB model, center it, wrap in a group, add to scene, and apply
   * material processing. Returns the wrapper group.
   */
  private loadModel(loader: GLTFLoader, opts: ModelConfig): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      loader.load(
        opts.url,
        (gltf) => {
          const root = gltf.scene as THREE.Group;
          root.position.set(0, 0, 0);
          root.updateWorldMatrix(true, true);
          const bounds = new THREE.Box3().setFromObject(root);
          const center = bounds.getCenter(new THREE.Vector3());

          const wrapper = new THREE.Group();
          wrapper.add(root);
          root.position.sub(center);
          this.scene.add(wrapper);
          wrapper.position.set(0, 1.25, -1);
          wrapper.scale.setScalar(opts.scale);

          cloneMaterialsPerMesh(root);

          // Build set of mesh names to skip during enhancement (they'll be replaced)
          if (opts.mirrorMeshName) {
            this.materialSkipNames.add(opts.mirrorMeshName);
          }

          if (opts.brighten) {
            enhanceMetallicMaterials(
              root,
              this.materialSkipNames.size > 0 ? this.materialSkipNames : undefined,
              this.metallicParams
            );
          }

          // Replace mirror mesh with a Reflector (only on this specific model)
          if (opts.mirrorMeshName) {
            const mirrorMesh = this.findMeshByName(root, opts.mirrorMeshName);
            if (mirrorMesh) {
              this.mirrorReflector = this.createReflector(mirrorMesh);
            } else {
              console.warn(`[CarouselScene] Mirror mesh "${opts.mirrorMeshName}" not found in ${opts.url}`);
            }
          }

          resolve(wrapper);
        },
        undefined,
        (error) => {
          console.error(`[CarouselScene] Failed to load model ${opts.url}:`, error);
          reject(error);
        }
      );
    });
  }

  /** Find a mesh by name in the hierarchy, returning the first match or null. */
  private findMeshByName(root: THREE.Object3D, name: string): THREE.Mesh | null {
    let found: THREE.Mesh | null = null;
    root.traverse((child) => {
      if (!found && child instanceof THREE.Mesh && child.name === name) {
        found = child;
      }
    });
    return found;
  }

  /**
   * Add a planar Reflector on top of the given mesh, keeping the original mesh
   * visible underneath. Both are grouped together and swapped into the scene
   * graph at the mesh's original position. Returns the Reflector.
   */
  private createReflector(mesh: THREE.Mesh): Reflector {
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const w = Math.min(size.width, MAX_REFLECTOR_SIZE);
    const h = Math.min(size.height, MAX_REFLECTOR_SIZE);

    // Compute bounding box of the mesh geometry to size and position the disk
    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox!;
    const geoWidth = bbox.max.x - bbox.min.x;
    const geoHeight = bbox.max.y - bbox.min.y;
    const centerX = (bbox.min.x + bbox.max.x) / 2;
    const centerY = (bbox.min.y + bbox.max.y) / 2;
    const radius = Math.max(geoWidth, geoHeight) / 2;

    // Create a circular reflector disk sized to cover the mesh surface
    const diskGeo = new THREE.CircleGeometry(radius, 64);
    this.mirrorDiskGeometry = diskGeo;
    const reflector = new Reflector(diskGeo, {
      clipBias: 0.003,
      textureWidth: w,
      textureHeight: h,
      color: 0xc0bbb5,
    });

    // Position the reflector plane at the geometry center, just above the surface
    reflector.position.set(centerX, centerY, bbox.max.z + 0.001);

    // Create a group that inherits the mesh's transform
    const group = new THREE.Group();
    group.name = mesh.name;
    group.position.copy(mesh.position);
    group.quaternion.copy(mesh.quaternion);
    group.scale.copy(mesh.scale);

    // Reset the mesh's local transform since the group now carries it
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);

    // Swap into the scene graph: group replaces mesh at the same parent
    const parent = mesh.parent;
    if (parent) {
      parent.add(group);
      parent.remove(mesh);
    }

    group.add(mesh);
    group.add(reflector);

    // Add a metallic rim (torus) around the mirror edge
    const rimThickness = radius * 0.04;
    const rimTubeRadius = rimThickness * 0.5;
    const rimGeo = new THREE.TorusGeometry(radius, rimTubeRadius, 16, 64);
    this.mirrorRimGeometry = rimGeo;
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 1.0,
      roughness: 0.25,
    });
    this.mirrorRimMaterial = rimMat;
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.set(centerX, centerY, bbox.max.z + 0.001);
    group.add(rimMesh);

    return reflector;
  }

  // --- Pan input handlers ---

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key !== "Shift" || e.repeat) return;
    if (!this.enableOrbitControls) return;
    this.spaceHeld = true;
    // Disable OrbitControls entirely while space is held so it doesn't
    // capture pointer events or interfere with our pan drag
    this.orbitControls.disconnect();
    this.orbitControls.enabled = false;
    this.onShiftHeldChange?.(true);
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.key !== "Shift") return;
    this.spaceHeld = false;
    this.isPanning = false;
    // Re-enable OrbitControls (update() will also sync enabled state each frame)
    if (this.enableOrbitControls) {
      this.orbitControls.connect(this.renderer.domElement);
      this.orbitControls.enabled = true;
    }
    this.onShiftHeldChange?.(false);
  }

  private onPanPointerDown(e: PointerEvent): void {
    if (!this.spaceHeld || !this.enableOrbitControls) return;
    if (e.button !== 0) return; // left click only
    this.isPanning = true;
    this.panStartMouse.set(e.clientX, e.clientY);
    this.panStartTarget.copy(this.orbitControls.target);
    this.panStartCameraPos.copy(this.camera.position);
    // Capture pointer so we get move/up even if cursor leaves the canvas
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  }

  private onPanPointerMove(e: PointerEvent): void {
    if (!this.isPanning) return;

    const dx = e.clientX - this.panStartMouse.x;
    const dy = e.clientY - this.panStartMouse.y;

    // Convert pixel delta to world-space pan delta.
    // Use camera's view to get right/up vectors for screen-aligned panning.
    // Scale factor: map pixels to world units based on camera FOV and distance.
    const distance = this.camera.position.distanceTo(this.orbitControls.target);
    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const heightInWorld = 2 * distance * Math.tan(fovRad / 2);
    const canvasHeight = this.renderer.domElement.clientHeight;
    const pixelToWorld = heightInWorld / canvasHeight;

    // Camera right and up vectors in world space (reuse pre-allocated vectors)
    this.camera.updateMatrixWorld(); // ensure matrix is current
    this._panRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    this._panUp.setFromMatrixColumn(this.camera.matrixWorld, 1);

    // Pan offset in world space (negate dx so dragging right moves view right)
    this._panDelta.set(0, 0, 0);
    this._panDelta.addScaledVector(this._panRight, -dx * pixelToWorld);
    this._panDelta.addScaledVector(this._panUp, dy * pixelToWorld);

    // New target and camera positions
    this._panNewTarget.copy(this.panStartTarget).add(this._panDelta);
    this._panNewCameraPos.copy(this.panStartCameraPos).add(this._panDelta);

    // Track pan offset for reset
    this._panBaseTarget.copy(this.currentLookAtTarget).sub(this.panOffset);
    this.panOffset.copy(this._panNewTarget).sub(this._panBaseTarget);

    this.orbitControls.target.copy(this._panNewTarget);
    this.camera.position.copy(this._panNewCameraPos);
  }

  private onPanPointerUp(e: PointerEvent): void {
    if (!this.isPanning) return;
    this.isPanning = false;
    // Release pointer capture
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore if capture was already released
    }
  }

  /** Reset pan offset (called when leaving explore mode or switching slides) */
  resetPan(): void {
    this.panOffset.set(0, 0, 0);
    this.spaceHeld = false;
    this.isPanning = false;
    // Re-enable OrbitControls in case space was held when reset was called
    if (this.enableOrbitControls && !this.orbitControls.enabled) {
      this.orbitControls.connect(this.renderer.domElement);
      this.orbitControls.enabled = true;
    }
    this.onShiftHeldChange?.(false);
  }

  /**
   * Update the carousel scene (call once per frame when active).
   */
  update(deltaTimeSeconds: number): void {
    // Don't re-enable OrbitControls while space is held (pan mode takes over)
    const shouldEnable = this.spaceHeld ? this.orbitControls.enabled : this.enableOrbitControls;

    // Connect/disconnect listeners when orbit mode toggles so they don't
    // block touch scrolling while inactive.
    if (shouldEnable && !this.orbitControls.enabled) {
      this.orbitControls.connect(this.renderer.domElement);
      this.orbitControls.enabled = true;
    } else if (!shouldEnable && this.orbitControls.enabled) {
      this.orbitControls.disconnect();
      this.orbitControls.enabled = false;
    }

    if (this.orbitControls.enabled) {
      this.orbitControls.update();
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    // Update reflector render target to match new size (clamped)
    if (this.mirrorReflector) {
      const size = new THREE.Vector2();
      this.renderer.getDrawingBufferSize(size);
      const w = Math.min(size.width, MAX_REFLECTOR_SIZE);
      const h = Math.min(size.height, MAX_REFLECTOR_SIZE);
      this.mirrorReflector.getRenderTarget().setSize(w, h);
    }
  }

  /**
   * Animate the camera to a new position and lookAt target along a smooth curve.
   * Kills any in-flight camera tween before starting a new one.
   */
  animateCameraTo(targetPosition: THREE.Vector3, targetLookAt: THREE.Vector3, duration: number = 2.5): gsap.core.Tween {
    // Kill any in-flight camera animation to prevent competing tweens
    if (this.activeCameraTween) {
      this.activeCameraTween.kill();
      this.activeCameraTween = null;
    }

    // Reset pan offset when animating to a new position (slide change)
    this.resetPan();

    const easeType = "power2.inOut";
    const startPosition = this.camera.position.clone();
    const startLookAt = this.currentLookAtTarget.clone();

    const currentLookAt = startLookAt.clone();
    const currentPos = startPosition.clone();
    const camera = this.camera;
    const self = this;

    // Use linear gsap tween and apply easing manually so position and lookAt
    // use the exact same eased t value — no mismatch, no wobble.
    const easeFn = gsap.parseEase(easeType);

    const tween = gsap.to(
      { t: 0 },
      {
        t: 1,
        duration,
        ease: "none",
        onUpdate() {
          const rawT = this.targets()[0].t;
          const t = easeFn(rawT);
          currentPos.lerpVectors(startPosition, targetPosition, t);
          camera.position.copy(currentPos);
          currentLookAt.lerpVectors(startLookAt, targetLookAt, t);
          camera.lookAt(currentLookAt);
          self.currentLookAtTarget.copy(currentLookAt);
          self.orbitControls.target.copy(currentLookAt);
        },
        onComplete() {
          self.activeCameraTween = null;
        },
      }
    );

    this.activeCameraTween = tween;
    return tween;
  }

  setActiveModel(carouselIndex: number): void {
    const activeSlide = this.carouselData[carouselIndex];
    const activeKey = activeSlide?.model;
    for (const [key, group] of this.models) {
      group.visible = activeKey !== undefined && key === activeKey;
    }
  }

  /** Re-apply metallic material enhancement with current GUI params. */
  private reapplyMetallicParams(): void {
    const skip = this.materialSkipNames.size > 0 ? this.materialSkipNames : undefined;
    for (const group of this.models.values()) {
      // The model root is the first child of the wrapper group
      const root = group.children[0];
      if (root) {
        enhanceMetallicMaterials(root, skip, this.metallicParams);
      }
    }
  }

  dispose(): void {
    this.disposed = true;

    // Kill any in-flight camera tween
    if (this.activeCameraTween) {
      this.activeCameraTween.kill();
      this.activeCameraTween = null;
    }

    // Remove pan event listeners
    window.removeEventListener("keydown", this.boundOnKeyDown);
    window.removeEventListener("keyup", this.boundOnKeyUp);
    this.renderer.domElement.removeEventListener("pointerdown", this.boundOnPointerDown);
    window.removeEventListener("pointermove", this.boundOnPointerMove);
    window.removeEventListener("pointerup", this.boundOnPointerUp);
    this.renderer.domElement.removeEventListener("mouseenter", this.boundOnMouseEnter);
    this.renderer.domElement.removeEventListener("mouseleave", this.boundOnMouseLeave);
    this.onShiftHeldChange = null;

    this.gui.destroy();
    this.orbitControls.dispose();
    if (this.backgroundTexture) {
      this.backgroundTexture.dispose();
    }
    this.dracoLoader.dispose();

    if (this.mirrorReflector) {
      this.mirrorReflector.dispose();
    }
    if (this.mirrorDiskGeometry) {
      this.mirrorDiskGeometry.dispose();
    }
    if (this.mirrorRimGeometry) {
      this.mirrorRimGeometry.dispose();
    }
    if (this.mirrorRimMaterial) {
      this.mirrorRimMaterial.dispose();
    }

    for (const group of this.models.values()) {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }
  }
}
