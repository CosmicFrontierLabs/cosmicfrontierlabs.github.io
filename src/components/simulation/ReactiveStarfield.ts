import * as THREE from "three";
import { simulationConfig } from "./simulationConfig";
import { vertexShader, fragmentShader } from "./shaders/reactiveStarfieldShaders";
import { convertWorldRadiusToNDC, lineSphereIntersection, projectWorldPositionsToNDC } from "./simulationUtils";

/**
 * Reactive starfield mesh with animated shader effects
 * Creates a cosmic background that responds to frustum positions
 * Uses a sphere geometry that wraps around the scene with texture on the inside
 */
export class ReactiveStarfield {
  private bgMesh: THREE.Mesh;
  private worldRadius: number;
  private frustumTargetsArray: THREE.Vector2[];
  private frustumIntersectionsArray: THREE.Vector2[];

  constructor(scene: THREE.Scene, width: number, height: number, renderer?: THREE.WebGLRenderer) {
    const config = simulationConfig.background;
    this.worldRadius = config.circleRadius;

    // Create a sphere geometry that wraps around the scene
    // SphereGeometry: radius, widthSegments, heightSegments
    const bgGeometry = new THREE.SphereGeometry(
      config.geometry.radius,
      config.geometry.widthSegments,
      config.geometry.heightSegments
    );

    // Create a placeholder texture (1x1 white) to prevent shader errors while loading
    const placeholderTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    placeholderTexture.needsUpdate = true;

    // Create a single material for the sphere
    // Initialize with positions far outside screen bounds to prevent unwanted lighting
    // Pre-allocate arrays to reuse each frame (avoid per-frame allocations)
    this.frustumTargetsArray = new Array(config.maxTelescopes).fill(0).map(() => new THREE.Vector2(9999, 9999));
    this.frustumIntersectionsArray = new Array(config.maxTelescopes * 2)
      .fill(0)
      .map(() => new THREE.Vector2(9999, 9999));
    const bgMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: {
        uFrustumTargets: { value: this.frustumTargetsArray },
        uFrustumIntersections: { value: this.frustumIntersectionsArray },
        uFrustumCount: { value: 0 },
        uFrustumIntersectionCount: { value: 0 },
        uRadius: { value: 0.1 }, // Will be updated with converted radius
        uResolution: { value: new THREE.Vector2(width, height) },
        uTexture: { value: placeholderTexture }, // Placeholder, will be replaced when texture loads
        uOpacityBase: { value: config.opacity.base },
        uOpacityHover: { value: config.opacity.hover },
        uBrightness: { value: config.brightness }, // Brightness multiplier
      },
      transparent: true, // Enable transparency for opacity effects
      depthTest: true,
      depthWrite: false,
      side: THREE.BackSide, // Render texture on the inside surface
    });

    this.bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    this.bgMesh.renderOrder = -1;
    this.bgMesh.position.set(0, 0, 0); // Center at origin
    scene.add(this.bgMesh);

    // Load texture asynchronously with proper filtering settings
    const bgTextureLoader = new THREE.TextureLoader();
    bgTextureLoader.load(
      config.texture.url,
      (texture) => {
        // Texture loaded successfully - configure for high quality
        texture.minFilter = THREE.LinearMipmapLinearFilter; // Best quality minification
        texture.magFilter = THREE.LinearFilter; // Best quality magnification
        texture.generateMipmaps = true; // Enable mipmaps for better quality at distance

        // Set anisotropy for better quality when viewing at angles
        if (renderer) {
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }

        // Clamp texture edges to avoid seams on sphere
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // Update the uniform
        const material = this.bgMesh.material as THREE.ShaderMaterial;
        material.uniforms.uTexture.value = texture;
        material.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.error("Error loading background texture:", error);
      }
    );
  }

  /**
   * Updates the resolution uniform for the material
   * @param width - New width
   * @param height - New height
   */
  setResolution(width: number, height: number): void {
    const material = this.bgMesh.material as THREE.ShaderMaterial;
    material.uniforms.uResolution.value.set(width, height);
  }

  updateFrustums(frustumOrigins: THREE.Vector3[], frustumTargets: THREE.Vector3[], camera: THREE.Camera): void {
    const config = simulationConfig.background;

    // Project targets to NDC
    const ndcTargets = projectWorldPositionsToNDC(frustumTargets, camera);

    // Use first frustum target as reference for radius conversion
    const referencePoint = frustumTargets.length > 0 ? frustumTargets[0] : new THREE.Vector3(0, 0, 0);
    const ndcRadius = convertWorldRadiusToNDC(this.worldRadius, referencePoint, camera);

    // Calculate intersection points of frustum lines with reactive starfield sphere
    const sphereCenter = new THREE.Vector3(0, 0, 0); // Reactive starfield sphere is centered at origin
    const sphereRadius = config.geometry.radius; // Scaled sphere radius

    const intersectionPoints: THREE.Vector3[] = [];
    for (let i = 0; i < frustumOrigins.length && i < frustumTargets.length; i++) {
      const intersections = lineSphereIntersection(frustumOrigins[i], frustumTargets[i], sphereCenter, sphereRadius);
      intersectionPoints.push(...intersections);
    }

    // Project intersection points to NDC
    const ndcIntersections = projectWorldPositionsToNDC(intersectionPoints, camera);

    const material = this.bgMesh.material as THREE.ShaderMaterial;
    const count = Math.min(ndcTargets.length, config.maxTelescopes);
    const intersectionCount = Math.min(ndcIntersections.length, config.maxTelescopes * 2);

    material.uniforms.uFrustumCount.value = count;
    material.uniforms.uFrustumIntersectionCount.value = intersectionCount;
    material.uniforms.uRadius.value = ndcRadius;

    // Reuse pre-allocated Vector2 arrays instead of creating new ones each frame
    // Update values in-place to avoid allocations
    for (let i = 0; i < config.maxTelescopes; i++) {
      if (i < count) {
        this.frustumTargetsArray[i].set(ndcTargets[i].x, ndcTargets[i].y);
      } else {
        // Place unused positions far outside NDC bounds (-1 to 1) to prevent any lighting effect
        this.frustumTargetsArray[i].set(999, 999);
      }
    }
    // Mark uniforms as needing update (Three.js will detect the change)
    material.uniforms.uFrustumTargets.value = this.frustumTargetsArray;

    // Update intersection points
    for (let i = 0; i < config.maxTelescopes * 2; i++) {
      if (i < intersectionCount) {
        this.frustumIntersectionsArray[i].set(ndcIntersections[i].x, ndcIntersections[i].y);
      } else {
        // Place unused positions far outside NDC bounds
        this.frustumIntersectionsArray[i].set(999, 999);
      }
    }
    material.uniforms.uFrustumIntersections.value = this.frustumIntersectionsArray;
  }
}
