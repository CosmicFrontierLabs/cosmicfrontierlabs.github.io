import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { ReactiveStarfield } from "./ReactiveStarfield";
import { inverseLerp, lerp } from "three/src/math/MathUtils.js";
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
      position: { x: 0, y: 1, z: 10 },
      lookAt: { x: 0, y: 0, z: 0 },
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
      position: { x: 4, y: 0.5, z: 3 },
      lookAt: { x: 0, y: 1, z: 0 },
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

function remap(val: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const t = inverseLerp(inMin, inMax, val);
  return lerp(outMin, outMax, t);
}

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
  private particles: THREE.Points;
  private spotlight: THREE.SpotLight;
  private spotlightTarget: THREE.Object3D;
  private ambientLight: THREE.AmbientLight;
  private keyLight: THREE.RectAreaLight;
  private rimLight: THREE.PointLight;
  private reactiveStarfield: ReactiveStarfield;

  /** Mouse position normalized 0-1, (0,0) = top-left */
  mousePosition = { x: 0.5, y: 0.5 };
  enableCameraReaction = false;

  /**
   * When true, the visible model auto-rotates and the camera stays fixed.
   * Set to false once the carousel UI is visible and interactive.
   */
  introMode = true;

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

    // Spotlight (initially off)
    this.spotlight = new THREE.SpotLight(0x88ccff, 0, 15, Math.PI / 8, 0.5, 1);
    this.spotlight.position.set(0, 5, 10);
    this.spotlightTarget = new THREE.Object3D();
    this.spotlightTarget.position.set(0, 0.5, 0);
    this.scene.add(this.spotlightTarget);
    this.spotlight.target = this.spotlightTarget;
    this.scene.add(this.spotlight);

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
    });

    // Particles (empty for now, numParticles = 0)
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    particleGeometry.setAttribute("startPosition", new THREE.Float32BufferAttribute([], 3));
    particleGeometry.setAttribute("endPosition", new THREE.Float32BufferAttribute([], 3));
    particleGeometry.setAttribute("t", new THREE.Float32BufferAttribute([], 1));
    const particleMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      vertexShader: `
        attribute float t;
        varying float vT;
        void main() {
          vT = t;
          float size = 0.2;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vT;
        void main() {
          float alpha = 1.0 - 2.0 * abs(0.5 - vT);
          gl_FragColor = vec4(vec3(0.3), alpha);
        }
      `,
    });
    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particles);
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
    const easeType = "power1.inOut";
    const startPosition = this.camera.position.clone();
    const startLookAt = new THREE.Vector3();
    this.camera.getWorldDirection(startLookAt);
    startLookAt.multiplyScalar(10).add(startPosition);

    const distance = startPosition.distanceTo(targetPosition);
    const midpoint = new THREE.Vector3().lerpVectors(startPosition, targetPosition, 0.5);
    const direction = new THREE.Vector3().subVectors(targetPosition, startPosition).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize();

    const controlPoint1 = new THREE.Vector3(
      startPosition.x + (midpoint.x - startPosition.x) * 0.3 + perpendicular.x * distance * 0.1,
      startPosition.y + distance * 0.25,
      startPosition.z + (midpoint.z - startPosition.z) * 0.3 - distance * 0.1
    );
    const controlPoint2 = new THREE.Vector3(
      targetPosition.x - (targetPosition.x - midpoint.x) * 0.3 - perpendicular.x * distance * 0.1,
      targetPosition.y + distance * 0.12,
      targetPosition.z - (targetPosition.z - midpoint.z) * 0.3 + distance * 0.1
    );

    const cameraCurve = new THREE.CatmullRomCurve3(
      [startPosition, controlPoint1, controlPoint2, targetPosition],
      false,
      "catmullrom",
      0.4
    );

    const currentLookAt = startLookAt.clone();
    const camera = this.camera;

    return gsap.to(
      { t: 0 },
      {
        t: 1,
        duration,
        ease: easeType,
        onUpdate() {
          const t = this.targets()[0].t;
          const easedT = gsap.parseEase(easeType)(t);
          const point = cameraCurve.getPoint(t);
          camera.position.copy(point);
          currentLookAt.lerpVectors(startLookAt, targetLookAt, easedT);
          camera.lookAt(currentLookAt);
        },
      }
    );
  }

  setActiveModel(carouselIndex: number): void {
    const modelType = carouselData[carouselIndex].model;
    const duration = 0.3;

    const setModelOpacity = (model: THREE.Group, opacity: number) => {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((mat) => {
            mat.transparent = true;
            mat.opacity = opacity;
          });
        }
      });
    };

    const fadeOut = (model: THREE.Group) => {
      return gsap.to(
        {},
        {
          duration,
          onUpdate: function () {
            setModelOpacity(model, 1 - this.progress());
          },
          onComplete: () => {
            model.visible = false;
          },
        }
      );
    };

    const fadeIn = (model: THREE.Group) => {
      model.visible = true;
      setModelOpacity(model, 0);
      return gsap.to(
        {},
        {
          duration,
          onUpdate: function () {
            setModelOpacity(model, this.progress());
          },
        }
      );
    };

    if (this.telescope && this.fullAssy) {
      if (modelType === "payload" && !this.telescope.visible) {
        fadeOut(this.fullAssy);
        fadeIn(this.telescope);
      } else if (modelType === "fullAssy" && !this.fullAssy.visible) {
        fadeOut(this.telescope);
        fadeIn(this.fullAssy);
      }
    } else {
      if (this.telescope) {
        this.telescope.visible = modelType === "payload";
      }
      if (this.fullAssy) {
        this.fullAssy.visible = modelType === "fullAssy";
      }
    }
  }

  updateMousePosition(event: MouseEvent): void {
    this.mousePosition = {
      x: remap(event.x, 0, window.innerWidth, 0, 1),
      y: remap(event.y, 0, window.innerHeight, 0, 1),
    };
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

    // Dispose particles
    this.particles.geometry.dispose();
    if (this.particles.material instanceof THREE.Material) {
      this.particles.material.dispose();
    }
  }
}
