import * as THREE from "three";
import { simulationConfig } from "./simulationConfig";
import { vertexShader, fragmentShader } from "./shaders/reactiveStarfieldShaders";
import { convertWorldRadiusToNDC, projectWorldPositionsToNDC } from "./projectionUtils";
import { lineSphereIntersection } from "./mathUtils";

/**
 * Optional overrides for ReactiveStarfield configuration.
 * Any provided values override the defaults from simulationConfig.
 */
export interface ReactiveStarfieldOptions {
  /** Sphere radius in world units */
  radius?: number;
  /** Base opacity when no frustums are nearby (0.0 - 1.0) */
  opacityBase?: number;
  /** Opacity when frustums are nearby (0.0 - 1.0) */
  opacityHover?: number;
  /** Brightness multiplier for the texture */
  brightness?: number;
}

/**
 * Reactive starfield mesh with animated shader effects
 * Creates a cosmic background that responds to frustum positions
 * Uses a sphere geometry that wraps around the scene with texture on the inside
 */
export class ReactiveStarfield {
  private bgMesh: THREE.Mesh;
  private scene: THREE.Scene;
  private worldRadius: number;
  private frustumTargetsArray: THREE.Vector2[];
  private frustumIntersectionsArray: THREE.Vector2[];

  // Pre-allocated temporaries for updateFrustums to avoid per-frame allocations
  private _ndcTargets: THREE.Vector2[];
  private _ndcIntersections: THREE.Vector2[];
  private _intersectionOut: THREE.Vector3[];
  private _intersectionPoints: THREE.Vector3[];
  private _referencePoint: THREE.Vector3;

  constructor(
    scene: THREE.Scene,
    width: number,
    height: number,
    renderer?: THREE.WebGLRenderer,
    options?: ReactiveStarfieldOptions
  ) {
    this.scene = scene;
    const config = simulationConfig.background;
    this.worldRadius = config.circleRadius;

    // Create a sphere geometry that wraps around the scene
    const sphereRadius = options?.radius ?? config.geometry.radius;
    const bgGeometry = new THREE.SphereGeometry(
      sphereRadius,
      config.geometry.widthSegments,
      config.geometry.heightSegments
    );

    // Create a placeholder texture (1x1 white) to prevent shader errors while loading
    const placeholderTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    placeholderTexture.needsUpdate = true;

    // Pre-allocate arrays to reuse each frame (avoid per-frame allocations)
    this.frustumTargetsArray = new Array(config.maxTelescopes).fill(0).map(() => new THREE.Vector2(9999, 9999));
    this.frustumIntersectionsArray = new Array(config.maxTelescopes * 2)
      .fill(0)
      .map(() => new THREE.Vector2(9999, 9999));

    // Pre-allocate NDC projection output arrays
    this._ndcTargets = new Array(config.maxTelescopes).fill(0).map(() => new THREE.Vector2());
    this._ndcIntersections = new Array(config.maxTelescopes * 2).fill(0).map(() => new THREE.Vector2());
    // Pre-allocate intersection scratch buffers
    this._intersectionOut = [new THREE.Vector3(), new THREE.Vector3()];
    this._intersectionPoints = new Array(config.maxTelescopes * 2).fill(0).map(() => new THREE.Vector3());
    this._referencePoint = new THREE.Vector3();

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
        uOpacityBase: { value: options?.opacityBase ?? config.opacity.base },
        uOpacityHover: { value: options?.opacityHover ?? config.opacity.hover },
        uBrightness: { value: options?.brightness ?? config.brightness },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.BackSide,
    });

    this.bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
    this.bgMesh.renderOrder = -1;
    this.bgMesh.position.set(0, 0, 0);
    scene.add(this.bgMesh);

    // Load texture asynchronously with proper filtering settings
    const bgTextureLoader = new THREE.TextureLoader();
    bgTextureLoader.load(
      config.texture.url,
      (texture) => {
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;

        if (renderer) {
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }

        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

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
   */
  setResolution(width: number, height: number): void {
    const material = this.bgMesh.material as THREE.ShaderMaterial;
    material.uniforms.uResolution.value.set(width, height);
  }

  updateFrustums(frustumOrigins: THREE.Vector3[], frustumTargets: THREE.Vector3[], camera: THREE.Camera): void {
    const config = simulationConfig.background;
    const numFrustums = Math.min(frustumTargets.length, config.maxTelescopes);

    // Project targets to NDC (writes into pre-allocated _ndcTargets)
    projectWorldPositionsToNDC(frustumTargets, camera, this._ndcTargets, numFrustums);

    // Use first frustum target as reference for radius conversion
    if (numFrustums > 0) {
      this._referencePoint.copy(frustumTargets[0]);
    } else {
      this._referencePoint.set(0, 0, 0);
    }
    const ndcRadius = convertWorldRadiusToNDC(this.worldRadius, this._referencePoint, camera);

    // Calculate intersection points of frustum lines with reactive starfield sphere
    const sphereRadius = config.geometry.radius;

    let totalIntersections = 0;
    for (let i = 0; i < numFrustums && i < frustumOrigins.length; i++) {
      const count = lineSphereIntersection(
        frustumOrigins[i],
        frustumTargets[i],
        this._referencePoint.set(0, 0, 0), // sphere centered at origin
        sphereRadius,
        this._intersectionOut
      );
      for (let j = 0; j < count && totalIntersections < config.maxTelescopes * 2; j++) {
        this._intersectionPoints[totalIntersections].copy(this._intersectionOut[j]);
        totalIntersections++;
      }
    }

    // Project intersection points to NDC (writes into pre-allocated _ndcIntersections)
    if (totalIntersections > 0) {
      projectWorldPositionsToNDC(this._intersectionPoints, camera, this._ndcIntersections, totalIntersections);
    }

    const material = this.bgMesh.material as THREE.ShaderMaterial;
    const intersectionCount = Math.min(totalIntersections, config.maxTelescopes * 2);

    material.uniforms.uFrustumCount.value = numFrustums;
    material.uniforms.uFrustumIntersectionCount.value = intersectionCount;
    material.uniforms.uRadius.value = ndcRadius;

    // Update values in-place to avoid allocations
    for (let i = 0; i < config.maxTelescopes; i++) {
      if (i < numFrustums) {
        this.frustumTargetsArray[i].set(this._ndcTargets[i].x, this._ndcTargets[i].y);
      } else {
        this.frustumTargetsArray[i].set(999, 999);
      }
    }
    material.uniforms.uFrustumTargets.value = this.frustumTargetsArray;

    for (let i = 0; i < config.maxTelescopes * 2; i++) {
      if (i < intersectionCount) {
        this.frustumIntersectionsArray[i].set(this._ndcIntersections[i].x, this._ndcIntersections[i].y);
      } else {
        this.frustumIntersectionsArray[i].set(999, 999);
      }
    }
    material.uniforms.uFrustumIntersections.value = this.frustumIntersectionsArray;
  }

  /**
   * Disposes of all Three.js resources to prevent memory leaks
   */
  dispose(): void {
    const material = this.bgMesh.material as THREE.ShaderMaterial;

    if (material.uniforms.uTexture.value) {
      material.uniforms.uTexture.value.dispose();
    }

    material.dispose();
    this.bgMesh.geometry.dispose();
    this.scene.remove(this.bgMesh);
  }
}
