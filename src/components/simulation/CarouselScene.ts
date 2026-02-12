import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ReactiveStarfield } from "./ReactiveStarfield";
import { lerp } from "three/src/math/MathUtils.js";
import gsap from "gsap";

const MIRROR_MESH_NAME = "mesh_0_55";

export interface CarouselItem {
  title: string;
  description: string;
  model: string;
  camera: {
    position: { x: number; y: number; z: number };
    lookAt: { x: number; y: number; z: number };
  };
}

export const carouselData: CarouselItem[] = [
  {
    title: "A New Kind of Telescope",
    description:
      "Introducing a revolutionary optical instrument designed to peer deeper into the cosmos than ever before. This next-generation payload assembly combines precision engineering with cutting-edge materials.",
    model: "payload",
    camera: {
      position: { x: 3, y: 1.5, z: 3 },
      lookAt: { x: 0.5, y: 1, z: 0 },
    },
  },
  {
    title: "Primary Optics Assembly",
    description:
      "The heart of the telescope: a precisely ground primary mirror assembly capable of capturing light from the farthest reaches of the observable universe. Every surface is polished to nanometer-level tolerances.",
    model: "payload",
    camera: {
      position: { x: -2, y: 1.5, z: 2.5 },
      lookAt: { x: 0, y: 0.5, z: 0 },
    },
  },
  {
    title: "Structural Framework",
    description:
      "A carbon-fiber composite truss structure provides exceptional rigidity while minimizing weight. This lattice design maintains optical alignment even under extreme thermal cycling in the vacuum of space.",
    model: "payload",
    camera: {
      position: { x: 0, y: 1, z: 10 },
      lookAt: { x: 0, y: 0, z: 0 },
    },
  },
  {
    title: "Thermal Management",
    description:
      "Advanced thermal control systems regulate temperature across the entire assembly. Multi-layer insulation and active heaters ensure stable operating conditions from -150°C to +100°C.",
    model: "payload",
    camera: {
      position: { x: 0, y: 4, z: 4 },
      lookAt: { x: 0, y: 0.5, z: 0 },
    },
  },
  {
    title: "Complete Optical System",
    description:
      "The full assembly reveals the integrated optical path from primary to secondary mirror. The hexapod actuator system provides six degrees of freedom for precise alignment, while real-time wavefront sensing ensures optimal image quality across the entire system.",
    model: "fullAssy",
    camera: {
      position: { x: 2, y: 5, z: 3 },
      lookAt: { x: 0, y: 1.5, z: -0.5 },
    },
  },
  {
    title: "Integrated Instrument Suite",
    description:
      "The complete assembly showcases how spectrographs, imaging sensors, and data processing units are seamlessly integrated within the instrument bay. This modular architecture enables in-orbit servicing and future capability upgrades while maintaining system integrity.",
    model: "fullAssy",
    camera: {
      position: { x: 9, y: 1, z: 4 },
      lookAt: { x: 0, y: 0.5, z: 0 },
    },
  },
  {
    title: "Power & Data Systems",
    description:
      "The full assembly integrates high-gain antennas and power distribution systems that connect the telescope to ground stations worldwide. With data transmission rates exceeding 100 Gbps, the complete system enables real-time delivery of high-resolution scientific data.",
    model: "fullAssy",
    camera: {
      position: { x: 0, y: -2, z: 4 },
      lookAt: { x: 0, y: 1.5, z: 0 },
    },
  },
  {
    title: "Complete Assembly",
    description:
      "The fully integrated telescope assembly represents the culmination of years of engineering refinement. Every subsystem—from optics to power, from instruments to thermal control—works in harmony to create an instrument that will transform our understanding of the cosmos.",
    model: "fullAssy",
    camera: {
      position: { x: 6, y: 4, z: 12 },
      lookAt: { x: 0, y: 0.5, z: 0 },
    },
  },
];

/**
 * Clone materials on every mesh so each mesh gets its own material instance.
 * This allows per-mesh material tweaks (e.g. brightening) without affecting
 * other meshes that originally shared the same material in the GLB.
 */
function cloneMaterialsPerMesh(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m: THREE.Material) => m.clone());
    } else {
      child.material = child.material.clone();
    }
  });
}

// --- Brighten-dark-materials tunable parameters ---
interface BrightenParams {
  minLuminance: number;
  metallicLumTarget: number;
  maxBoostFactor: number;
  minChannelFraction: number;
  metallicThreshold: number;
  maxMetalness: number;
  texturedMetalnessThreshold: number;
  texturedEmissive: number;
  highMetalnessThreshold: number;
  highRoughnessThreshold: number;
  extremeRoughness: number;
  whiteMetalGreyColor: number;
  emissiveMetallic: number;
  emissiveDielectric: number;
}

const defaultBrightenParams: BrightenParams = {
  minLuminance: 0.08,
  metallicLumTarget: 0.22,
  maxBoostFactor: 5.0,
  minChannelFraction: 0.5,
  metallicThreshold: 0.4,
  maxMetalness: 0.2,
  texturedMetalnessThreshold: 0.3,
  texturedEmissive: 0.05,
  highMetalnessThreshold: 0.8,
  highRoughnessThreshold: 0.8,
  extremeRoughness: 0.6,
  whiteMetalGreyColor: 0.45,
  emissiveMetallic: 0.06,
  emissiveDielectric: 0.03,
};

/** Compute perceptual luminance of an RGB color. */
function luminance(c: THREE.Color): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

/**
 * Case 0: Fix dark textured materials.
 * Metallic + textured is a common dark-material pattern. Reduce metalness so
 * diffuse light can reflect off the surface, and add a small emissive boost.
 */
function fixDarkTexturedMaterial(
  mat: THREE.Material,
  metalness: number,
  p: BrightenParams,
): void {
  if (!("map" in mat) || !(mat.map instanceof THREE.Texture)) return;
  if (metalness <= p.texturedMetalnessThreshold) return;

  (mat as THREE.MeshStandardMaterial).metalness = Math.min(metalness, p.maxMetalness);
  if ("emissive" in mat && mat.emissive instanceof THREE.Color) {
    const eLum = luminance(mat.emissive as THREE.Color);
    if (eLum < 0.03) {
      mat.emissive = new THREE.Color(p.texturedEmissive, p.texturedEmissive, p.texturedEmissive * 1.2);
    }
  }
  mat.needsUpdate = true;
}

/**
 * Case 1: Brighten dark base colors.
 * Dark metallic materials get an extra-aggressive boost because even after
 * capping metalness they remain very dim.
 */
function brightenDarkBaseColor(
  mat: THREE.Material,
  c: THREE.Color,
  lum: number,
  metalness: number,
  p: BrightenParams,
): void {
  if (lum >= p.minLuminance) return;

  const targetLum = metalness > p.metallicThreshold ? p.metallicLumTarget : p.minLuminance;
  const boost = targetLum / Math.max(lum, 0.001);
  const factor = Math.min(boost, p.maxBoostFactor);
  c.multiplyScalar(factor);
  const minChannel = targetLum * p.minChannelFraction;
  c.r = Math.max(c.r, minChannel);
  c.g = Math.max(c.g, minChannel);
  c.b = Math.max(c.b, minChannel);
  mat.needsUpdate = true;
}

/**
 * Case 2: Cap metalness so ambient/diffuse light is reflected.
 * Without an environment map, metallic materials rely entirely on specular
 * reflections from direct lights, making them near-black from most angles.
 */
function capMetalness(
  mat: THREE.Material,
  c: THREE.Color,
  lum: number,
  metalness: number,
  roughness: number,
  p: BrightenParams,
): void {
  if (metalness <= p.metallicThreshold) return;

  if (metalness > p.highMetalnessThreshold && roughness > p.highRoughnessThreshold) {
    // High metalness + high roughness: convert fully to dielectric.
    (mat as THREE.MeshStandardMaterial).metalness = 0.0;
    (mat as THREE.MeshStandardMaterial).roughness = p.extremeRoughness;
    if (lum > 0.8) {
      c.setRGB(p.whiteMetalGreyColor, p.whiteMetalGreyColor, p.whiteMetalGreyColor + 0.03);
    }
  } else {
    (mat as THREE.MeshStandardMaterial).metalness = Math.min(
      mat.metalness as number,
      p.maxMetalness,
    );
  }
  mat.needsUpdate = true;
}

/**
 * Case 3: Emissive boost on dark parts — stronger for originally-metallic
 * materials so they read clearly against the dark background.
 */
function boostDarkEmissive(
  mat: THREE.Material,
  lum: number,
  metalness: number,
  p: BrightenParams,
): void {
  if (lum >= p.minLuminance) return;
  if (!("emissive" in mat) || !(mat.emissive instanceof THREE.Color)) return;

  const eLum = luminance(mat.emissive as THREE.Color);
  if (eLum < 0.03) {
    const emStr = metalness > p.metallicThreshold ? p.emissiveMetallic : p.emissiveDielectric;
    mat.emissive = new THREE.Color(emStr, emStr, emStr * 1.1);
    mat.needsUpdate = true;
  }
}

function makeReflective(mat: THREE.Material, envMap: THREE.CubeTexture): void {
  const std = mat as THREE.MeshStandardMaterial;

  // Clear all texture maps so the surface is pure mirror reflection
  if (std.map) std.map = null;
  if (std.normalMap) std.normalMap = null;
  if (std.roughnessMap) std.roughnessMap = null;
  if (std.metalnessMap) std.metalnessMap = null;
  if (std.aoMap) std.aoMap = null;

  // Perfect mirror PBR: full metal, zero roughness
  std.metalness = 1.0;
  std.roughness = 0.0;
  std.color.setRGB(0.95, 0.95, 0.95);
  std.envMap = envMap;
  std.envMapIntensity = 1.0;

  // Clear emissive so it doesn't interfere
  if (std.emissive) std.emissive.setRGB(0, 0, 0);

  std.needsUpdate = true;
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
  private totTime: number = 0.0;
  private ambientLight: THREE.AmbientLight;
  private keyLight: THREE.RectAreaLight;
  private rimLight: THREE.PointLight;
  private renderer: THREE.WebGLRenderer;
  private cubeRenderTarget: THREE.WebGLCubeRenderTarget;
  private cubeCamera: THREE.CubeCamera;
  private mirrorMesh: THREE.Mesh | null = null;
  private reactiveStarfield: ReactiveStarfield;
  private orbitControls: OrbitControls;

  /** Tracks the current lookAt target for smooth camera transitions */
  private currentLookAtTarget = new THREE.Vector3(0, 0, 0);

  /** Mouse position normalized 0-1, (0,0) = top-left */
  mousePosition = { x: 0.5, y: 0.5 };
  enableCameraReaction = false;

  constructor(width: number, height: number, renderer: THREE.WebGLRenderer) {
    RectAreaLightUniformsLib.init();
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = null;

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

    // CubeCamera for real-time mirror reflections
    this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.cubeCamera = new THREE.CubeCamera(0.1, 100, this.cubeRenderTarget);
    this.scene.add(this.cubeCamera);

    // Orbit controls
    this.orbitControls = new OrbitControls(this.camera, renderer.domElement);
    this.orbitControls.enabled = this.enableOrbitControls;
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;
    this.orbitControls.enablePan = false;
    this.orbitControls.target.copy(this.currentLookAtTarget);

    // Reactive starfield
    this.reactiveStarfield = new ReactiveStarfield(this.scene, width, height, renderer, {
      radius: 15,
      opacityBase: 0.4,
      opacityHover: 1.0,
      brightness: 2.5,
    });

    // Load models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    gltfLoader.load("/models/20260102_Payload_assy_no_baffle.glb", (gltf) => {
      const root = gltf.scene as THREE.Group;
      // this.printMeshNames(root, "Payload");
      root.position.set(0, 0, 0);
      root.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(root);
      const center = bounds.getCenter(new THREE.Vector3());

      this.telescope = new THREE.Group();
      this.telescope.add(root);
      root.position.sub(center);
      this.scene.add(this.telescope);
      this.telescope.position.set(0, 1.25, -1);
      this.telescope.scale.set(5.0, 5.0, 5.0);
      cloneMaterialsPerMesh(root);
      this.brightenDarkMaterials(root);
    });

    gltfLoader.load("/models/20260102_Full_Assy.glb", (gltf) => {
      const root = gltf.scene as THREE.Group;
      // this.printMeshNames(root, "Full Assembly");
      root.position.set(0, 0, 0);
      root.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(root);
      const center = bounds.getCenter(new THREE.Vector3());

      this.fullAssy = new THREE.Group();
      this.fullAssy.add(root);
      root.position.sub(center);
      this.scene.add(this.fullAssy);
      this.fullAssy.position.set(0, 1.25, -1);
      this.fullAssy.scale.set(3.0, 3.0, 3.0);
      this.fullAssy.visible = false;
      cloneMaterialsPerMesh(root);
      // this.brightenDarkMaterials(root); // TODO: uncomment
    });
  }

  /**
   * Recursively print all mesh names in a model hierarchy
   * and assign a unique debug color to each distinct material.
   */
  private printMeshNames(root: THREE.Object3D, label: string): void {
    // Generate visually distinct colors using golden-ratio hue spacing
    const materialColors = new Map<THREE.Material, THREE.Color>();
    let hueIndex = 0;
    const goldenRatio = 0.618033988749895;

    const getDebugColor = (mat: THREE.Material): THREE.Color => {
      if (materialColors.has(mat)) return materialColors.get(mat)!;
      const hue = (hueIndex * goldenRatio) % 1.0;
      hueIndex++;
      const color = new THREE.Color().setHSL(hue, 0.9, 0.55);
      materialColors.set(mat, color);
      return color;
    };

    console.group(`[${label}] Mesh names in GLB model:`);
    root.traverse((child) => {
      const type = child.type;
      const depth: string[] = [];
      let parent = child.parent;
      while (parent && parent !== root) {
        depth.push(parent.name || "(unnamed)");
        parent = parent.parent;
      }
      const path = depth.reverse().join(" > ");
      const name = child.name || "(unnamed)";
      if (child instanceof THREE.Mesh) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const matInfo = materials
          .map((m: THREE.Material) => {
            const debugColor = getDebugColor(m);
            const hex = "#" + debugColor.getHexString();
            // Apply debug color
            if ("color" in m && m.color instanceof THREE.Color) {
              m.color.copy(debugColor);
            }
            // Clear maps/textures so solid color is visible
            if ("map" in m && m.map) {
              (m as THREE.MeshStandardMaterial).map = null;
            }
            // Reset metalness/roughness for visibility
            if ("metalness" in m) {
              (m as THREE.MeshStandardMaterial).metalness = 0.0;
            }
            if ("roughness" in m) {
              (m as THREE.MeshStandardMaterial).roughness = 0.8;
            }
            // Clear emissive so it doesn't wash out the debug color
            if ("emissive" in m && m.emissive instanceof THREE.Color) {
              m.emissive.setRGB(0, 0, 0);
            }
            m.needsUpdate = true;
            return `${m.name || m.type} (${hex})`;
          })
          .join(", ");
        console.log(`[Mesh] ${path ? path + " > " : ""}${name}  (material: ${matInfo})`);
      } else {
        console.log(`[${type}] ${path ? path + " > " : ""}${name}`);
      }
    });
    console.groupEnd();
  }

  /**
   * Traverse a model and lighten any very dark materials so they're visible
   * against the dark space background. Handles dark base colors, high metalness
   * on dark surfaces, and non-Standard material types.
   */
  private brightenDarkMaterials(root: THREE.Object3D): void {
    const p = defaultBrightenParams;

    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];

      materials.forEach((mat) => {
        if (!("color" in mat) || !(mat.color instanceof THREE.Color)) return;

        if (child.name === MIRROR_MESH_NAME) {
          makeReflective(mat, this.cubeRenderTarget.texture);
          this.mirrorMesh = child;
          return;
        }

        const c = mat.color as THREE.Color;
        const lum = luminance(c);
        const metalness =
          "metalness" in mat && typeof mat.metalness === "number" ? mat.metalness : 0;
        const roughness =
          "roughness" in mat && typeof mat.roughness === "number" ? mat.roughness : 0;

        fixDarkTexturedMaterial(mat, metalness, p);
        brightenDarkBaseColor(mat, c, lum, metalness, p);
        capMetalness(mat, c, lum, metalness, roughness, p);
        boostDarkEmissive(mat, lum, metalness, p);
      });
    });
  }

  /**
   * Update the carousel scene (call once per frame when active).
   */
  update(deltaTimeSeconds: number): void {
    this.totTime += deltaTimeSeconds;

    // Mouse-reactive camera
    if (this.enableCameraReaction) {
      const mouseX = lerp(-6, 6, this.mousePosition.x);
      const mouseY = lerp(-6, 8, this.mousePosition.y);
      const newX = THREE.MathUtils.damp(this.camera.position.x, mouseX, 4, deltaTimeSeconds);
      const newY = THREE.MathUtils.damp(this.camera.position.y, mouseY, 4, deltaTimeSeconds);
      this.camera.position.x = newX;
      this.camera.position.y = newY;
      this.camera.lookAt(0, 0, 0);
    }

    this.orbitControls.enabled = this.enableOrbitControls;
    this.orbitControls.update();

    // Update cube camera for mirror reflections
    if (this.mirrorMesh) {
      // Position cube camera at the mirror mesh's world position
      this.mirrorMesh.getWorldPosition(this.cubeCamera.position);
      // Hide mirror while capturing reflections to avoid self-reflection
      this.mirrorMesh.visible = false;
      this.cubeCamera.update(this.renderer, this.scene);
      this.mirrorMesh.visible = true;
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.reactiveStarfield.setResolution(width, height);
  }

  /**
   * Animate the camera to a new position and lookAt target along a smooth curve.
   */
  animateCameraTo(targetPosition: THREE.Vector3, targetLookAt: THREE.Vector3, duration: number = 2.5): gsap.core.Tween {
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

    return gsap.to(
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
      }
    );
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
    this.orbitControls.dispose();
    this.reactiveStarfield.dispose();
    this.cubeRenderTarget.dispose();

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
