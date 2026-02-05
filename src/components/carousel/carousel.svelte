<script lang="ts">
  // canvas is fixed with top-0, left-0, set height and width
  // And then it uses a grid to place things
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { GLTFLoader } from "three/examples/jsm/Addons.js";
  import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
  import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
  import groundVertexShader from "./ground.vert?raw";
  import groundFragmentShader from "./ground.frag?raw";
  import bgVertexShader from "./bg.vert?raw";
  import bgFragmentShader from "./bg.frag?raw";
  import { inverseLerp, lerp } from "three/src/math/MathUtils.js";
  import { GUI } from "three/addons/libs/lil-gui.module.min.js";
  import Stats from "three/examples/jsm/libs/stats.module.js";
  import gsap from "gsap";

  const carouselData = [
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
        position: { x: 0, y: -2, z: 10 },
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
  let curCarouselItemIndex = $state(0);
  let progress = $state(0);
  let autoplayInterval: ReturnType<typeof setInterval> | null = null;
  let progressInterval: ReturnType<typeof setInterval> | null = null;
  const SLIDE_DURATION = 15000; // 15 seconds
  const PROGRESS_UPDATE_INTERVAL = 50; // Update progress every 50ms

  // Refs for text animation
  let titleEl: HTMLHeadingElement;
  let descriptionEl: HTMLParagraphElement;

  let container: HTMLDivElement;
  // Mouse position normalized to 0 and 1. where (0,0) is the top left
  // So it's NOT uv coordinates (which would have (0,0) in the bottom left)
  let mousePosition = $state({ x: 0, y: 0 });
  let enableCameraReaction = $state(true);

  function remap(val: number, inMin: number, inMax: number, outMin: number, outMax: number) {
    const t = inverseLerp(inMin, inMax, val);
    return lerp(outMin, outMax, t);
  }

  function easeInOutQuad(x: number): number {
    return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  }

  function randFloat(min: number, max: number) {
    return (max - min) * Math.random() + min;
  }

  function handleMousemove(event: any) {
    mousePosition = {
      x: remap(event.x, 0, window.innerWidth, 0, 1),
      y: remap(event.y, 0, window.innerHeight, 0, 1),
    };
  }

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
    if (index === curCarouselItemIndex) return;

    const nextItem = carouselData[index];
    enableCameraReaction = false;

    const tl = gsap.timeline();

    tl.to(titleEl, { opacity: 0, duration: 0.3 }, 0);
    tl.to(descriptionEl, { opacity: 0, duration: 0.3 }, 0);

    tl.call(
      () => {
        curCarouselItemIndex = index;
        sketch.setActiveModel(index);
      },
      [],
      0.4
    );

    tl.fromTo(titleEl, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);
    tl.fromTo(descriptionEl, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.5);

    const targetPos = new THREE.Vector3(
      nextItem.camera.position.x,
      nextItem.camera.position.y,
      nextItem.camera.position.z
    );
    const targetLookAt = new THREE.Vector3(
      nextItem.camera.lookAt.x,
      nextItem.camera.lookAt.y,
      nextItem.camera.lookAt.z
    );

    tl.add(sketch.animateCameraTo(targetPos, targetLookAt, 2.5), 0);

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

  class Sketch {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    telescope: THREE.Group | null = null;
    fullAssy: THREE.Group | null = null;
    roots: THREE.Group | null = null;
    prevTime: number = 0.0;
    totTime: number = 0.0;
    groundMaterial: THREE.ShaderMaterial;
    bgMaterial: THREE.ShaderMaterial;
    rings: THREE.Group;
    ringConfigs: Array<{ rx: number; ry: number; rz: number; radius: number; speed: number }>;
    particles: THREE.Points;
    gui: GUI;
    stats: Stats;
    spotlight: THREE.SpotLight;
    spotlightTarget: THREE.Object3D;

    // New lighting
    ambientLight: THREE.AmbientLight;
    keyLight: THREE.RectAreaLight;
    rimLight: THREE.PointLight;

    // GUI params
    params = {
      ambientLightEnabled: true,
      showRings: false,
    };

    constructor() {
      // Initialize RectAreaLight uniforms
      RectAreaLightUniformsLib.init();

      this.scene = new THREE.Scene();
      this.scene.background = null;

      this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
      this.camera.position.set(0, 1, 10);
      this.camera.lookAt(0, 0, 0);

      // Ambient light (reduced intensity)
      this.ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
      this.scene.add(this.ambientLight);

      // Key light - soft RectAreaLight for fill
      this.keyLight = new THREE.RectAreaLight(0xfff5e6, 2.0, 4, 4);
      this.keyLight.position.set(3, 3, 5);
      this.keyLight.lookAt(0, 0, 0);
      this.scene.add(this.keyLight);

      // Rim light - PointLight for edge highlighting
      this.rimLight = new THREE.PointLight(0xff6b35, 15.0, 20, 2);
      this.rimLight.position.set(-3, 2, -2);
      this.scene.add(this.rimLight);

      // Spotlight for highlighting (initially off)
      this.spotlight = new THREE.SpotLight(0x88ccff, 0, 15, Math.PI / 8, 0.5, 1);
      this.spotlight.position.set(0, 5, 10);
      this.spotlightTarget = new THREE.Object3D();
      this.spotlightTarget.position.set(0, 0.5, 0);
      this.scene.add(this.spotlightTarget);
      this.spotlight.target = this.spotlightTarget;
      this.scene.add(this.spotlight);

      // Fog
      this.scene.fog = new THREE.Fog(0x0a1428, 5.0, 30.0);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
      this.renderer.setSize(container.clientWidth, container.clientHeight);

      // Tone mapping
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      container.appendChild(this.renderer.domElement);

      // Textures if we figure out where to use them
      // const tl = new THREE.TextureLoader();
      // const barkAlbedo = tl.load('/assets/albedo.webp');
      // barkAlbedo.colorSpace = THREE.SRGBColorSpace;
      // const barkNormal = tl.load('/assets/normal.webp');
      // const barkRoughness = tl.load('/assets/roughness.webp');
      // const barkMetallic = tl.load('/assets/metallic.webp');

      // Add the armillary sphere rings with Deep Space Cool color palette
      this.rings = new THREE.Group();

      // Deep Space Cool ring colors
      const ringColors = [
        0x8899aa, // Silver/Steel - cold metallic
        0x6699cc, // Ice Blue - frozen oxygen tones
        0x4455aa, // Deep Indigo - nebula depths
        0x7766bb, // Violet - cosmic purple
        0x77aacc, // Pale Cyan - ionized gas
        0x556688, // Dark Slate - shadow ring
      ];

      // Ring configurations for armillary sphere - each with different orientations, radii, and rotation speeds
      this.ringConfigs = [
        { rx: 0, ry: 0, rz: 0, radius: 5.0, speed: 0.05 }, // Equatorial (outer)
        { rx: Math.PI / 2, ry: 0, rz: 0, radius: 5.0, speed: -0.08 }, // Meridian front-back
        { rx: Math.PI / 4, ry: 0, rz: 0, radius: 5.0, speed: -0.04 }, // Tilted 45°
        { rx: -Math.PI / 4, ry: 0, rz: 0, radius: 5.0, speed: 0.07 }, // Tilted -45°
      ];

      for (let i = 0; i < this.ringConfigs.length; i++) {
        const config = this.ringConfigs[i];
        // Create geometry per-ring with its own radius
        const ringGeometry = new THREE.TorusGeometry(config.radius, 0.015, 16, 64);
        // Create metallic material with emissive glow for each ring
        const ringMaterial = new THREE.MeshStandardMaterial({
          color: ringColors[i],
          metalness: 0.7,
          roughness: 0.4,
          emissive: ringColors[i],
          emissiveIntensity: 0.15,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = config.rx;
        ring.rotation.y = config.ry;
        ring.rotation.z = config.rz;
        this.rings.add(ring);
      }

      // Position the armillary sphere at the model center
      this.rings.position.set(0, 1.25, -1);
      this.rings.visible = this.params.showRings;
      this.scene.add(this.rings);

      const payloadPath = "/models/20260102_Payload_assy_no_baffle.glb";

      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("/draco/");

      const gltfLoader = new GLTFLoader();
      gltfLoader.setDRACOLoader(dracoLoader);
      gltfLoader.load(payloadPath, (gltf: any) => {
        const root = gltf.scene as THREE.Group;

        // Center the tree
        root.position.set(0, 0, 0);
        root.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(root);
        const center = bounds.getCenter(new THREE.Vector3());

        this.telescope = new THREE.Group();
        this.telescope.add(root);
        root.position.sub(center);
        this.scene.add(this.telescope);

        // Now move it to the position we want
        this.telescope.position.set(0, 1.25, -1);
        this.telescope.scale.set(5.0, 5.0, 5.0);
      });

      const fullAssyPath = "/models/20260102_Full_Assy.glb";
      gltfLoader.load(fullAssyPath, (gltf: any) => {
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

      // Add the background
      const bgPlaneGeometry = new THREE.SphereGeometry(40, 32, 16);
      const bgGeometry = bgPlaneGeometry.toNonIndexed();
      const numBgTriangles = bgGeometry.attributes.position.count;
      const bgBaryArray = new Float32Array(3 * numBgTriangles);
      for (let i = 0; i < numBgTriangles; i += 3) {
        bgBaryArray.set([1, 0, 0], (i + 0) * 3);
        bgBaryArray.set([0, 1, 0], (i + 1) * 3);
        bgBaryArray.set([0, 0, 1], (i + 2) * 3);
      }
      bgGeometry.setAttribute("aBary", new THREE.BufferAttribute(bgBaryArray, 3));
      this.bgMaterial = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          uTime: { value: 0.0 },
          uGradientTop: { value: new THREE.Color("#050510") },
          uGradientBottom: { value: new THREE.Color("#0a1428") },
          uWireframeOpacity: { value: 0.4 },
        },
        transparent: true,
        depthWrite: false,
        vertexShader: bgVertexShader,
        fragmentShader: bgFragmentShader,
      });
      const bgMesh = new THREE.Mesh(bgGeometry, this.bgMaterial);
      bgMesh.position.set(0, 0, 0);
    //   this.scene.add(bgMesh);

      // add the ground
      const groundPlaneGeometry = new THREE.PlaneGeometry(10, 10, 10, 10);
      const groundGeometry = groundPlaneGeometry.toNonIndexed();

      // Add the bary attribute
      let numGroundTriangles = groundGeometry.attributes.position.count;
      const baryArray = new Float32Array(3 * numGroundTriangles);
      for (let i = 0; i < numGroundTriangles; i += 3) {
        baryArray.set([1, 0, 0], (i + 0) * 3);
        baryArray.set([0, 1, 0], (i + 1) * 3);
        baryArray.set([0, 0, 1], (i + 2) * 3);
      }
      groundGeometry.setAttribute("aBary", new THREE.BufferAttribute(baryArray, 3));

      this.groundMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0.0 },
        },
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: true,
        depthTest: true,
        fog: false,
        vertexShader: groundVertexShader,
        fragmentShader: groundFragmentShader,
      });
      const ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
      ground.rotation.x = -Math.PI / 1.8;
      ground.position.set(0, -4, -2);
      // this.scene.add(ground);

      // Add the floating points
      const particleGeometry = new THREE.BufferGeometry();
      const start = [];
      const end = [];
      const ts = [];
      const numParticles = 0;
      for (let i = 0; i < numParticles; i++) {
        const startX = randFloat(-10, 10);
        const startY = randFloat(-2, 10);
        const startZ = 0;

        const endX = randFloat(-10, 10);
        const endY = randFloat(-2, 10);
        const endZ = 0;

        start.push(startX, startY, startZ);
        end.push(endX, endY, endZ);
        ts.push(Math.random());
      }

      particleGeometry.setAttribute("position", new THREE.Float32BufferAttribute(start, 3));
      particleGeometry.setAttribute("startPosition", new THREE.Float32BufferAttribute(start, 3));
      particleGeometry.setAttribute("endPosition", new THREE.Float32BufferAttribute(end, 3));
      particleGeometry.setAttribute("t", new THREE.Float32BufferAttribute(ts, 1));

      // const particleMaterial = new THREE.PointsMaterial({ size: 0.1, color: 0x555555, })
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
					    // Fade out as it's life ends and then fade
						float alpha = 1.0 - 2.0 * abs(0.5 - vT);
						gl_FragColor = vec4(vec3(0.3), alpha);
					}
				`,
      });

      this.particles = new THREE.Points(particleGeometry, particleMaterial);
      this.scene.add(this.particles);

      // Set up the GUI
      this.gui = new GUI();
      this.setupGUI(ground);
      // this.gui.close();
      this.gui.hide();

      // Set up performance stats
      this.stats = new Stats();
      this.stats.dom.style.position = "absolute";
      this.stats.dom.style.top = "0px";
      this.stats.dom.style.right = "0px";
      this.stats.dom.style.left = "auto";
      // container.appendChild(this.stats.dom);

      this.resize();
      this.animate();
    }

    setupGUI(_ground: THREE.Mesh) {
      this.gui
        .add(this.params, "ambientLightEnabled")
        .name("Ambient Light Enabled")
        .onChange((value: boolean) => {
          this.ambientLight.visible = value;
        });
      this.gui
        .add(this.params, "showRings")
        .name("Show Rings")
        .onChange((value: boolean) => {
          this.rings.visible = value;
        });
    }

    animate() {
      this.stats.begin();
      requestAnimationFrame(() => this.animate());

      if (this.prevTime === 0.0) {
        this.prevTime = Date.now();
      }
      const curTime = Date.now();
      const deltaTimeSeconds = (curTime - this.prevTime) / 1000.0;
      this.totTime += deltaTimeSeconds;
      this.prevTime = curTime;
      this.bgMaterial.uniforms.uTime.value += deltaTimeSeconds;
      this.groundMaterial.uniforms.uTime.value += deltaTimeSeconds;

      // Rotate the armillary sphere group slowly
      this.rings.rotation.y += deltaTimeSeconds * 0.1;
      this.rings.rotation.x = Math.sin(this.totTime * 0.15) * 0.1;

      // Rotate each ring individually at its own speed
      for (let i = 0; i < this.ringConfigs.length; i++) {
        const ring = this.rings.children[i] as THREE.Mesh;
        const config = this.ringConfigs[i];
        // Rotate around the ring's local z-axis (which creates rotation in the plane of the ring)
        ring.rotation.z += deltaTimeSeconds * config.speed;
      }

      // Update particles
      const startPositions = this.particles.geometry.attributes.startPosition;
      const endPositions = this.particles.geometry.attributes.endPosition;
      const ts = this.particles.geometry.attributes.t;
      const positions = [];
      const newTs = [];
      for (let i = 0; i < startPositions.count; i++) {
        const startX = startPositions.array[i * 3 + 0];
        const startY = startPositions.array[i * 3 + 1];
        const startZ = startPositions.array[i * 3 + 2];

        const endX = endPositions.array[i * 3 + 0];
        const endY = endPositions.array[i * 3 + 1];
        const endZ = endPositions.array[i * 3 + 2];
        const thisT = ts.array[i];

        const x = lerp(startX, endX, thisT);
        const y = lerp(startY, endY, thisT);
        const z = lerp(startZ, endZ, thisT);

        positions.push(x, y, z);
        const newT = (thisT + 0.001) % 1;
        newTs.push(newT);
      }
      this.particles.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      this.particles.geometry.setAttribute("t", new THREE.Float32BufferAttribute(newTs, 1));

      // Update camera
      if (enableCameraReaction) {
        const mouseX = lerp(-6, 6, mousePosition.x);
        const mouseY = lerp(-6, 8, mousePosition.y);

        // https://threejs.org/docs/#MathUtils..damp
        const newX = THREE.MathUtils.damp(this.camera.position.x, mouseX, 4, deltaTimeSeconds);
        const newY = THREE.MathUtils.damp(this.camera.position.y, mouseY, 4, deltaTimeSeconds);

        this.camera.position.x = newX;
        this.camera.position.y = newY;
        this.camera.lookAt(0, 0, 0);
      }

      this.renderer.render(this.scene, this.camera);
      this.stats.end();
    }

    resize() {
      if (!container) {
        return;
      }

      const width = container.clientWidth;
      const height = container.clientHeight;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    /**
     * Animate the camera to a new position and lookAt target along a smooth curve.
     * Uses dynamic control points based on travel distance for natural motion.
     */
    animateCameraTo(
      targetPosition: THREE.Vector3,
      targetLookAt: THREE.Vector3,
      duration: number = 2.5
    ): gsap.core.Tween {
      const easeType = "power1.inOut";
      const startPosition = this.camera.position.clone();

      // Get current lookAt from where the camera is pointing
      const startLookAt = new THREE.Vector3();
      this.camera.getWorldDirection(startLookAt);
      startLookAt.multiplyScalar(10).add(startPosition);

      // Calculate dynamic control points based on travel distance
      const distance = startPosition.distanceTo(targetPosition);
      const midpoint = new THREE.Vector3().lerpVectors(startPosition, targetPosition, 0.5);

      // Direction vector from start to target (normalized)
      const direction = new THREE.Vector3().subVectors(targetPosition, startPosition).normalize();

      // Calculate perpendicular offset for arc (cross with up vector)
      const up = new THREE.Vector3(0, 1, 0);
      const perpendicular = new THREE.Vector3().crossVectors(direction, up).normalize();

      // Control point 1: early in path, lifted up and offset
      const controlPoint1 = new THREE.Vector3(
        startPosition.x + (midpoint.x - startPosition.x) * 0.3 + perpendicular.x * distance * 0.1,
        startPosition.y + distance * 0.25,
        startPosition.z + (midpoint.z - startPosition.z) * 0.3 - distance * 0.1
      );

      // Control point 2: late in path, still slightly elevated
      const controlPoint2 = new THREE.Vector3(
        targetPosition.x - (targetPosition.x - midpoint.x) * 0.3 - perpendicular.x * distance * 0.1,
        targetPosition.y + distance * 0.12,
        targetPosition.z - (targetPosition.z - midpoint.z) * 0.3 + distance * 0.1
      );

      const cameraCurve = new THREE.CatmullRomCurve3(
        [startPosition, controlPoint1, controlPoint2, targetPosition],
        false,
        "catmullrom",
        0.4 // Lower tension for smoother curves
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

            // Apply same easing to lookAt for synchronized motion
            const easedT = gsap.parseEase(easeType)(t);

            // Position follows the curve
            const point = cameraCurve.getPoint(t);
            camera.position.copy(point);

            // LookAt uses eased interpolation for smooth synchronized motion
            currentLookAt.lerpVectors(startLookAt, targetLookAt, easedT);
            camera.lookAt(currentLookAt);
          },
        }
      );
    }

    setActiveModel(carouselIndex: number) {
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

    dispose() {}
  }
  let sketch: Sketch;

  onMount(() => {
    sketch = new Sketch();

    const handleResize = () => {
      sketch.resize();
    };

    window.addEventListener("resize", handleResize);
    startAutoplay();

    return () => {
      sketch.dispose();
      stopAutoplay();
      window.removeEventListener("resize", handleResize);
    };
  });
</script>

<div class="carousel-wrapper">
  <div bind:this={container} class="three-container"></div>
  <!-- The mouseMove can be here since the overlay-content is the exact same size.
	 They're both position fixed with inset 0. -->
  <div class="overlay-content" onmousemove={handleMousemove} aria-label="Stuff" role="application">
    <div class="bg-glass2">
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
  <div
    id="my-cursor"
    style="--x: {mousePosition.x}; --y: {mousePosition.y}; --text: '{mousePosition.x.toFixed(
      3
    )}, {mousePosition.y.toFixed(3)}';"
  ></div>
</div>

<style>

	.carousel-wrapper {
		height: 100%;
		width: 100%;
		position: absolute;
		inset: 0;
	}

  .three-container {
    position: absolute;
    inset: 0;
    z-index: 0;
    height: 80%;
    width: 100%;
  }

  h2 {
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

  .overlay-content {
    position: absolute;
    bottom: 2%;
    width: 100%;
    z-index: 1;

    padding-block: 1rem;
    padding-inline: 2rem;
    display: flex;
    flex-direction: column;
	justify-content: center;
	align-items: center;
  }

  .description-wrapper {
    padding: 2ch 2ch;
    font-size: 0.875rem;
    max-width: 60ch;
    min-height: 8lh;
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

  #my-cursor {
	display: none;
    position: absolute;
    left: calc(var(--x) * 100% - 12px);
    top: calc(var(--y) * 100% - 12px);
    height: 24px;
    width: 24px;
    z-index: 2;
    pointer-events: none;
    user-select: none;

    --corner: 5px;
    --thickness: 1px;
    --plus: 0px;

    background:
		/* corners */
      linear-gradient(currentColor 0 0) left top,
      linear-gradient(currentColor 0 0) left top,
      linear-gradient(currentColor 0 0) right top,
      linear-gradient(currentColor 0 0) right top,
      linear-gradient(currentColor 0 0) left bottom,
      linear-gradient(currentColor 0 0) left bottom,
      linear-gradient(currentColor 0 0) right bottom,
      linear-gradient(currentColor 0 0) right bottom,
      /* plus */ linear-gradient(currentColor 0 0) center,
      linear-gradient(currentColor 0 0) center;

    background-repeat: no-repeat;

    background-size:
		/* corners */
      var(--corner) var(--thickness),
      var(--thickness) var(--corner),
      var(--corner) var(--thickness),
      var(--thickness) var(--corner),
      var(--corner) var(--thickness),
      var(--thickness) var(--corner),
      var(--corner) var(--thickness),
      var(--thickness) var(--corner),
      /* plus */ var(--plus) var(--thickness),
      var(--thickness) var(--plus);

    transition: background-size 160ms cubic-bezier(0.4, 0, 0.2, 1);

    &:active {
      --corner: 0px;
      --plus: 10px;
    }

    &:after {
      content: var(--text, "default");
      white-space: nowrap;
      position: absolute;
      bottom: -1lh;
      left: 100%;
      font-size: 6px;
    }
  }
</style>
