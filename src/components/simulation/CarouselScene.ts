import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { ReactiveStarfield } from "./ReactiveStarfield";
import { lerp } from "three/src/math/MathUtils.js";
import gsap from "gsap";

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
      position: { x: 3, y: 0.5, z: 3 },
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
 * CarouselScene manages the 3D carousel scene (models, lights, camera, rings).
 * It does NOT own a renderer—it renders into a shared renderer passed to it.
 */
export class CarouselScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  private telescope: THREE.Group | null = null;
  private fullAssy: THREE.Group | null = null;
  private totTime: number = 0.0;
  private ambientLight: THREE.AmbientLight;
  private keyLight: THREE.RectAreaLight;
  private rimLight: THREE.PointLight;
  private reactiveStarfield: ReactiveStarfield;

  /** Tracks the current lookAt target for smooth camera transitions */
  private currentLookAtTarget = new THREE.Vector3(0, 0, 0);

  /** Mouse position normalized 0-1, (0,0) = top-left */
  mousePosition = { x: 0.5, y: 0.5 };
  enableCameraReaction = false;

  constructor(width: number, height: number, renderer: THREE.WebGLRenderer) {
    RectAreaLightUniformsLib.init();

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(0, 1, 10);
    this.camera.lookAt(0, 0, 0);

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
      this.brightenDarkMaterials(root);
    });

    gltfLoader.load("/models/20260102_Full_Assy.glb", (gltf) => {
      const root = gltf.scene as THREE.Group;
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
      this.brightenDarkMaterials(root);
    });
  }

  /**
   * Traverse a model and lighten any very dark materials so they're visible
   * against the dark space background. Handles dark base colors, high metalness
   * on dark surfaces, and non-Standard material types.
   */
  private brightenDarkMaterials(root: THREE.Object3D): void {
    // --- Tunable parameters ---
    const minLuminance = 0.08; // Threshold below which base colors get brightened
    const metallicLumTarget = 0.22; // Brightness target for dark metallic materials
    const maxBoostFactor = 5.0; // Max multiplier when brightening dark colors
    const minChannelFraction = 0.5; // Floor per-channel as fraction of target luminance
    const metallicThreshold = 0.4; // Metalness above which material is considered metallic
    const maxMetalness = 0.2; // Cap for metalness on non-extreme materials
    const texturedMetalnessThreshold = 0.3; // Metalness threshold for textured material fix
    const texturedEmissive = 0.05; // Emissive strength for dark textured materials
    const highMetalnessThreshold = 0.8; // Metalness threshold for extreme case
    const highRoughnessThreshold = 0.8; // Roughness threshold for extreme case
    const extremeRoughness = 0.6; // Roughness to assign in extreme metallic+rough case
    const whiteMetalGreyColor = 0.45; // Grey value for bright extreme-case materials
    const emissiveMetallic = 0.06; // Emissive strength for dark metallic parts
    const emissiveDielectric = 0.03; // Emissive strength for dark non-metallic parts

    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        if (!("color" in mat) || !(mat.color instanceof THREE.Color)) return;

        const c = mat.color as THREE.Color;
        const lum = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        const metalness = "metalness" in mat && typeof mat.metalness === "number" ? mat.metalness : 0;
        const roughness = "roughness" in mat && typeof mat.roughness === "number" ? mat.roughness : 0;

        // 0) Textured materials: the color factor may be bright but the
        //    texture itself dark, making the rendered result near-black.
        //    We can't sample the texture cheaply, but metallic + textured
        //    is the common dark-material pattern. Reduce metalness so
        //    diffuse light can reflect off the surface.
        if ("map" in mat && mat.map instanceof THREE.Texture && metalness > texturedMetalnessThreshold) {
          (mat as THREE.MeshStandardMaterial).metalness = Math.min(metalness, maxMetalness);
          if ("emissive" in mat && mat.emissive instanceof THREE.Color) {
            const e = mat.emissive as THREE.Color;
            const eLum = 0.299 * e.r + 0.587 * e.g + 0.114 * e.b;
            if (eLum < 0.03) {
              mat.emissive = new THREE.Color(texturedEmissive, texturedEmissive, texturedEmissive * 1.2);
            }
          }
          mat.needsUpdate = true;
        }

        // 1) Brighten dark base colors.  Dark metallic materials need an
        //    extra-aggressive boost because even after capping metalness they
        //    remain very dim (the original color was chosen to look good with
        //    full specular metallic shading, not diffuse).
        if (lum < minLuminance) {
          const targetLum = metalness > metallicThreshold ? metallicLumTarget : minLuminance;
          const boost = targetLum / Math.max(lum, 0.001);
          const factor = Math.min(boost, maxBoostFactor);
          c.multiplyScalar(factor);
          const minChannel = targetLum * minChannelFraction;
          c.r = Math.max(c.r, minChannel);
          c.g = Math.max(c.g, minChannel);
          c.b = Math.max(c.b, minChannel);
          mat.needsUpdate = true;
        }

        // 2) Without an environment map, metallic materials rely entirely on
        //    specular reflections from direct lights, making them appear
        //    near-black from most viewing angles. Cap metalness so that
        //    ambient/diffuse light is reflected.
        if (metalness > metallicThreshold) {
          // High metalness + high roughness is the worst case (no diffuse,
          // dim specular) — convert fully to dielectric.
          if (metalness > highMetalnessThreshold && roughness > highRoughnessThreshold) {
            mat.metalness = 0.0;
            mat.roughness = extremeRoughness;
            if (lum > 0.8) {
              c.setRGB(whiteMetalGreyColor, whiteMetalGreyColor, whiteMetalGreyColor + 0.03);
            }
          } else {
            // For all other metallic materials, retain a hint of metallic
            // sheen but ensure enough diffuse reflection to stay visible.
            mat.metalness = Math.min(mat.metalness as number, maxMetalness);
          }
          mat.needsUpdate = true;
        }

        // 4) Emissive boost on dark parts — stronger for originally-metallic
        //    materials so they read clearly against the dark background.
        if ("emissive" in mat && mat.emissive instanceof THREE.Color && lum < minLuminance) {
          const e = mat.emissive as THREE.Color;
          const eLum = 0.299 * e.r + 0.587 * e.g + 0.114 * e.b;
          if (eLum < 0.03) {
            const emStr = metalness > metallicThreshold ? emissiveMetallic : emissiveDielectric;
            mat.emissive = new THREE.Color(emStr, emStr, emStr * 1.1);
            mat.needsUpdate = true;
          }
        }
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
    this.reactiveStarfield.dispose();

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
