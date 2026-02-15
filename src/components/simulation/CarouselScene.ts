import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { cloneMaterialsPerMesh, brightenDarkMaterials } from "./materialUtils";
import { carouselData } from "./carouselData";
import gsap from "gsap";

export type { CarouselItem } from "./carouselData";
export { carouselData } from "./carouselData";

/** Mesh name in the payload GLB that should become a planar reflector. */
const MIRROR_MESH_NAME = "mesh_0_55";

/** Maximum reflector render target dimension to limit GPU cost on high-DPI displays. */
const MAX_REFLECTOR_SIZE = 2048;

interface LoadModelOptions {
  url: string;
  scale: number;
  brighten: boolean;
  /** Mesh name to replace with a Reflector (only on this model). */
  mirrorMeshName?: string;
}

/**
 * CarouselScene manages the 3D carousel scene (models, lights, camera, rings).
 * It does NOT own a renderer—it renders into a shared renderer passed to it.
 */
export class CarouselScene {
  enableOrbitControls: boolean = false;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private telescope: THREE.Group | null = null;
  private fullAssy: THREE.Group | null = null;
  private ambientLight: THREE.AmbientLight;
  private keyLight: THREE.RectAreaLight;
  private rimLight: THREE.PointLight;
  private renderer: THREE.WebGLRenderer;
  private mirrorReflector: Reflector | null = null;
  private hdrTexture: THREE.Texture | null = null;
  private disposed = false;
  private orbitControls: OrbitControls;
  private dracoLoader: DRACOLoader;
  private activeCameraTween: gsap.core.Tween | null = null;

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
  onSpaceHeldChange: ((held: boolean) => void) | null = null;
  /** Whether the mouse is currently over the canvas */
  private mouseOverCanvas = false;

  // Bound event handlers for cleanup
  private boundOnKeyDown: (e: KeyboardEvent) => void;
  private boundOnKeyUp: (e: KeyboardEvent) => void;
  private boundOnPointerDown: (e: PointerEvent) => void;
  private boundOnPointerMove: (e: PointerEvent) => void;
  private boundOnPointerUp: (e: PointerEvent) => void;
  private boundOnMouseEnter: () => void;
  private boundOnMouseLeave: () => void;

  constructor(width: number, height: number, renderer: THREE.WebGLRenderer) {
    RectAreaLightUniformsLib.init();
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a1428);

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const initialCamera = carouselData[0].camera;
    this.camera.position.set(initialCamera.position.x, initialCamera.position.y, initialCamera.position.z);
    this.camera.lookAt(initialCamera.lookAt.x, initialCamera.lookAt.y, initialCamera.lookAt.z);
    this.currentLookAtTarget.set(initialCamera.lookAt.x, initialCamera.lookAt.y, initialCamera.lookAt.z);

    // Ambient light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(this.ambientLight);

    // Key light - soft RectAreaLight for fill
    this.keyLight = new THREE.RectAreaLight(0xfff5e6, 2.0, 4, 4);
    this.keyLight.position.set(3, 3, 5);
    this.keyLight.lookAt(0, 0, 0);
    this.scene.add(this.keyLight);

    // Rim light
    this.rimLight = new THREE.PointLight(0xff6b35, 15.0, 20, 2);
    this.rimLight.position.set(-3, 2, -2);
    this.scene.add(this.rimLight);

    // Fog
    this.scene.fog = new THREE.Fog(0x0a1428, 5.0, 30.0);

    // Orbit controls
    this.orbitControls = new OrbitControls(this.camera, renderer.domElement);
    this.orbitControls.enabled = this.enableOrbitControls;
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;
    this.orbitControls.enablePan = false;
    this.orbitControls.target.copy(this.currentLookAtTarget);

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

    // Load HDR environment background (async, non-blocking)
    new HDRLoader().load("/textures/HDR_multi_nebulae_1_4k.hdr", (texture) => {
      // Scene was disposed while loading — clean up and bail
      if (this.disposed) {
        texture.dispose();
        return;
      }
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.hdrTexture = texture;
      // Fade in: start dim and animate backgroundIntensity to target
      this.scene.background = texture;
      this.scene.backgroundIntensity = 0;
      // this.scene.environment = texture;
      // this.scene.environmentIntensity = 0.5;
      gsap.to(this.scene, {
        backgroundIntensity: 2,
        duration: 1.5,
        ease: "power2.inOut",
      });
    });

    // Loaders
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath("/draco/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(this.dracoLoader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // Load payload model (with mirror reflector)
    this.loadModel(gltfLoader, {
      url: "/models/20260102_Payload_assy_no_baffle.glb",
      scale: 5.0,
      brighten: true,
      mirrorMeshName: MIRROR_MESH_NAME,
    }).then((group) => {
      this.telescope = group;
    });

    // Load full assembly model
    this.loadModel(gltfLoader, {
      url: "/models/20260102_Full_Assy.glb",
      scale: 3.0,
      brighten: true,
    }).then((group) => {
      group.visible = false;
      this.fullAssy = group;
    });
  }

  /**
   * Load a GLB model, center it, wrap in a group, add to scene, and apply
   * material processing. Returns the wrapper group.
   */
  private loadModel(loader: GLTFLoader, opts: LoadModelOptions): Promise<THREE.Group> {
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

          // Build set of mesh names to skip during brightening (they'll be replaced)
          const skipNames = new Set<string>();
          if (opts.mirrorMeshName) {
            skipNames.add(opts.mirrorMeshName);
          }

          if (opts.brighten) {
            brightenDarkMaterials(root, skipNames.size > 0 ? skipNames : undefined);
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
   * Replace a mesh in the scene graph with a Reflector using the same geometry,
   * preserving its local transform. Returns the new Reflector.
   */
  private createReflector(mesh: THREE.Mesh): Reflector {
    const size = new THREE.Vector2();
    this.renderer.getDrawingBufferSize(size);
    const w = Math.min(size.width, MAX_REFLECTOR_SIZE);
    const h = Math.min(size.height, MAX_REFLECTOR_SIZE);

    const reflector = new Reflector(mesh.geometry, {
      clipBias: 0.003,
      textureWidth: w,
      textureHeight: h,
      color: 0xb5b5b5,
    });

    // Copy the mesh's local transform
    reflector.name = mesh.name;
    reflector.position.copy(mesh.position);
    reflector.quaternion.copy(mesh.quaternion);
    reflector.scale.copy(mesh.scale);

    // Swap in the scene graph
    const parent = mesh.parent;
    if (parent) {
      parent.add(reflector);
      parent.remove(mesh);
    }

    // Dispose old materials
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else if (mesh.material) {
      mesh.material.dispose();
    }

    return reflector;
  }

  // --- Pan input handlers ---

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key !== "Shift" || e.repeat) return;
    if (!this.enableOrbitControls) return;
    this.spaceHeld = true;
    // Disable OrbitControls entirely while space is held so it doesn't
    // capture pointer events or interfere with our pan drag
    this.orbitControls.enabled = false;
    this.onSpaceHeldChange?.(true);
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (e.key !== "Shift") return;
    this.spaceHeld = false;
    this.isPanning = false;
    // Re-enable OrbitControls (update() will also sync enabled state each frame)
    if (this.enableOrbitControls) {
      this.orbitControls.enabled = true;
    }
    this.onSpaceHeldChange?.(false);
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

    // Camera right and up vectors in world space
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    this.camera.getWorldDirection(new THREE.Vector3()); // ensure matrix is current
    right.setFromMatrixColumn(this.camera.matrixWorld, 0); // camera X axis
    up.setFromMatrixColumn(this.camera.matrixWorld, 1); // camera Y axis

    // Pan offset in world space (negate dx so dragging right moves view right)
    const panDelta = new THREE.Vector3();
    panDelta.addScaledVector(right, -dx * pixelToWorld);
    panDelta.addScaledVector(up, dy * pixelToWorld);

    // New target and camera positions
    const newTarget = this.panStartTarget.clone().add(panDelta);
    const newCameraPos = this.panStartCameraPos.clone().add(panDelta);

    // Track pan offset for reset
    const baseTarget = new THREE.Vector3();
    baseTarget.copy(this.currentLookAtTarget).sub(this.panOffset);
    this.panOffset.copy(newTarget).sub(baseTarget);

    this.orbitControls.target.copy(newTarget);
    this.camera.position.copy(newCameraPos);
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
    if (this.enableOrbitControls) {
      this.orbitControls.enabled = true;
    }
    this.onSpaceHeldChange?.(false);
  }

  /**
   * Update the carousel scene (call once per frame when active).
   */
  update(deltaTimeSeconds: number): void {
    // Don't re-enable OrbitControls while space is held (pan mode takes over)
    if (!this.spaceHeld) {
      this.orbitControls.enabled = this.enableOrbitControls;
    }
    this.orbitControls.update();
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
    const modelType = carouselData[carouselIndex].model;

    if (this.telescope) {
      this.telescope.visible = modelType === "payload";
    }
    if (this.fullAssy) {
      this.fullAssy.visible = modelType === "fullAssy";
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
    this.onSpaceHeldChange = null;

    this.orbitControls.dispose();
    if (this.hdrTexture) {
      this.hdrTexture.dispose();
    }
    this.dracoLoader.dispose();

    if (this.mirrorReflector) {
      this.mirrorReflector.dispose();
    }

    const disposeGroup = (group: THREE.Group | null) => {
      if (!group) return;
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
    };
    disposeGroup(this.telescope);
    disposeGroup(this.fullAssy);
  }
}
