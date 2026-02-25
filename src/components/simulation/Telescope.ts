import * as THREE from "three";
import { localCircleOnSphere, calculateOrbitalPosition, rayIntersectsSphere } from "./mathUtils";
import { simulationConfig } from "./simulationConfig";
import { ArcLoader } from "./ArcLoader";

/**
 * Represents a telescope in 3D space.
 * Used to visualize viewing volumes or light cones.
 *
 * Performance: all per-frame temporaries are pre-allocated as instance or
 * static fields to eliminate GC pressure in the animation loop.
 *
 * Telescope bodies and frustum cones are rendered via InstancedMesh (owned by
 * EarthScene). Each Telescope stores its instance index and updates the
 * corresponding instance matrix in update().
 */
export class Telescope {
  // Static constant for up vector (avoids allocation in update loop)
  private static readonly UP_VECTOR = new THREE.Vector3(0, 1, 0);

  // Static shared resources for better performance
  static hasInitializedStaticResources: boolean = false;
  static frustumMaterial: THREE.MeshBasicMaterial | null = null;
  static frustumGeometry: THREE.CylinderGeometry | null = null;
  static telescopeMaterial: THREE.MeshBasicMaterial | null = null;
  static telescopeBodyGeometry: THREE.BoxGeometry | null = null;
  static trailCubeGeometry: THREE.BoxGeometry | null = null;

  // Static helpers for instanced matrix computation
  private static _dummy: THREE.Object3D;
  private static _childRotMatrix: THREE.Matrix4;
  private static _tempMatrix: THREE.Matrix4;

  scene: THREE.Scene;
  instanceIndex: number;

  origin: THREE.Vector3;
  target: THREE.Vector3;

  radioArcLoader: ArcLoader;
  orbitalRadius: number;
  orbitalSpeed: number;
  inclination: number;
  initialPhase: number;
  longitudeOfAscendingNode: number;
  earthCenter: THREE.Vector3;
  shouldTrackMouse: boolean;

  // Trail system properties — each cube gets its own material for individual opacity
  trailGroup: THREE.Group;
  trailCubes: Array<{ mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; createdAt: number }>;
  /** Pool of disposed trail cube meshes + materials ready for reuse */
  private trailPool: Array<{ mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }>;
  lastTrailSpawnTime: number;
  trailDuration: number = 3.5; // seconds
  trailSpawnInterval: number = 0.15; // seconds

  // Reusable temporary objects to avoid allocations in update loop
  tempSpherical: THREE.Spherical;
  tempTargetSpherical: THREE.Spherical;
  tempResultSpherical: THREE.Spherical;
  originToTargetVector: THREE.Vector3;
  originToTargetMidPoint: THREE.Vector3;
  private _desiredTarget: THREE.Vector3;

  constructor(scene: THREE.Scene, origin: THREE.Vector3, shouldTrackMouse: boolean, instanceIndex: number) {
    this.scene = scene;
    this.instanceIndex = instanceIndex;

    // 1. Initialize static resources
    this.initializeStaticResources();

    // 2. Initialize reusable temporary objects
    this.tempSpherical = new THREE.Spherical();
    this.tempTargetSpherical = new THREE.Spherical();
    this.tempResultSpherical = new THREE.Spherical();
    this.originToTargetVector = new THREE.Vector3();
    this.originToTargetMidPoint = new THREE.Vector3();
    this._desiredTarget = new THREE.Vector3();

    // 3. Initialize origin and target positions
    const originSpherical = new THREE.Spherical().setFromVector3(origin);
    const target = new THREE.Spherical(
      simulationConfig.background.geometry.radius,
      originSpherical.phi,
      originSpherical.theta
    );
    this.origin = origin.clone();
    this.target = new THREE.Vector3().setFromSpherical(target);

    // 4. Initialize orbital properties
    this.orbitalRadius = origin.distanceTo(simulationConfig.earth.position);
    this.orbitalSpeed = simulationConfig.telescope.angleSpeed;
    this.inclination = Math.PI / 2 + (Math.random() - 0.5) * 0.2;
    this.longitudeOfAscendingNode = Math.random() * Math.PI * 2;
    this.initialPhase = Math.random() * Math.PI * 2;
    this.earthCenter = simulationConfig.earth.position.clone();
    this.shouldTrackMouse = shouldTrackMouse;

    // Initialize trail system before update() is called
    this.trailGroup = new THREE.Group();
    this.trailCubes = [];
    this.trailPool = [];
    this.lastTrailSpawnTime = 0;
    this.scene.add(this.trailGroup);

    // Compute initial orbital position (no mesh updates yet — EarthScene drives that)
    this.updateOriginAndTarget(0, new THREE.Vector3(0, 0, 0));

    this.radioArcLoader = new ArcLoader(this.scene, this.origin.clone());
  }

  private initializeStaticResources(): void {
    if (Telescope.hasInitializedStaticResources) {
      return;
    }
    Telescope.hasInitializedStaticResources = true;

    // 1. Initialize frustum material
    Telescope.frustumMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    });

    // 2. Initialize frustum geometry
    Telescope.frustumGeometry = new THREE.CylinderGeometry(
      simulationConfig.telescope.targetRadius,
      simulationConfig.telescope.originRadius,
      simulationConfig.telescope.telescopeLength,
      12,
      1,
      false
    );

    // 3. Initialize telescope material
    Telescope.telescopeMaterial = new THREE.MeshBasicMaterial({ color: simulationConfig.baseColor });

    // 4. Initialize telescope body geometry (BoxGeometry used by InstancedMesh)
    const radius = simulationConfig.telescope.telescopeWidth;
    Telescope.telescopeBodyGeometry = new THREE.BoxGeometry(radius, radius, radius);

    // 5. Initialize trail cube geometry
    const cubeSize = simulationConfig.telescope.telescopeWidth * 0.25;
    Telescope.trailCubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);

    // 6. Initialize instancing helpers
    Telescope._dummy = new THREE.Object3D();
    Telescope._childRotMatrix = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    Telescope._tempMatrix = new THREE.Matrix4();
  }

  /**
   * Updates the target position based on mouse tracking or normal orbital behavior.
   */
  private updateOriginAndTarget(elapsedTime: number, mouseWorldPosition: THREE.Vector3): void {
    // 1. Update origin (writes into this.origin in-place)
    calculateOrbitalPosition(
      elapsedTime,
      this.orbitalRadius,
      this.orbitalSpeed,
      this.inclination,
      this.initialPhase,
      this.longitudeOfAscendingNode,
      this.earthCenter,
      this.origin
    );

    // 2. Check if mouse tracking is enabled and mouse position is available
    let useMousePosition = false;
    if (this.shouldTrackMouse && mouseWorldPosition) {
      const wouldPassThroughEarth = rayIntersectsSphere(
        this.origin,
        mouseWorldPosition,
        simulationConfig.earth.position,
        simulationConfig.earth.radius
      );

      if (!wouldPassThroughEarth) {
        useMousePosition = true;
      }
    }

    // 3. Update target based on mouse position if valid
    if (useMousePosition && mouseWorldPosition) {
      // Lerp target towards the mouse world position (in-place)
      this.target.lerp(mouseWorldPosition, 0.01);
      return;
    }

    // 4. Update target based on current origin position (normal behavior)
    this.tempSpherical.setFromVector3(this.origin);
    this.tempTargetSpherical.set(
      simulationConfig.background.geometry.radius,
      this.tempSpherical.phi,
      this.tempSpherical.theta
    );
    localCircleOnSphere(
      elapsedTime,
      this.tempTargetSpherical,
      this.tempResultSpherical,
      simulationConfig.background.circleRadius,
      simulationConfig.telescope.frustumTargetSpeed
    );

    // 5. Calculate the desired target position and lerp towards it (in-place)
    this._desiredTarget.setFromSpherical(this.tempResultSpherical);
    this.target.lerp(this._desiredTarget, 0.01);
  }

  /**
   * Acquires a trail cube mesh, either from the pool or by creating a new one.
   */
  private acquireTrailCube(): { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial } {
    if (this.trailPool.length > 0) {
      return this.trailPool.pop()!;
    }
    // Create new material (each cube needs its own for individual opacity)
    const material = new THREE.MeshBasicMaterial({
      color: simulationConfig.baseColor,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(Telescope.trailCubeGeometry!, material);
    return { mesh, material };
  }

  /**
   * Updates the trail system: creates new trail cubes at intervals and fades out old ones.
   */
  private updateCubeTrail(elapsedTime: number): void {
    if (!this.trailCubes || !this.trailGroup) {
      return;
    }

    // Create new trail cube at fixed intervals
    if (elapsedTime - this.lastTrailSpawnTime >= this.trailSpawnInterval) {
      const { mesh, material } = this.acquireTrailCube();
      mesh.position.copy(this.origin);
      material.opacity = 1.0;
      this.trailGroup.add(mesh);
      this.trailCubes.push({ mesh, material, createdAt: elapsedTime });
      this.lastTrailSpawnTime = elapsedTime;
    }

    // Update opacity and recycle old cubes
    for (let i = this.trailCubes.length - 1; i >= 0; i--) {
      const trailCube = this.trailCubes[i];
      const age = elapsedTime - trailCube.createdAt;

      if (age >= this.trailDuration) {
        // Return cube to pool instead of disposing
        this.trailGroup.remove(trailCube.mesh);
        this.trailPool.push({ mesh: trailCube.mesh, material: trailCube.material });
        this.trailCubes.splice(i, 1);
      } else {
        // Fade out based on age
        trailCube.material.opacity = 1.0 - age / this.trailDuration;
      }
    }
  }

  /**
   * Updates the telescope position, orientation, and instance matrices for the
   * shared InstancedMesh objects (frustum + telescope body).
   */
  update(
    elapsedTime: number,
    mouseWorldPosition: THREE.Vector3,
    frustumInstanced: THREE.InstancedMesh,
    telescopeInstanced: THREE.InstancedMesh
  ): void {
    // 1. Update origin (the orbital position of the telescope)
    this.updateOriginAndTarget(elapsedTime, mouseWorldPosition);

    // 2. Calculate origin to target vector and origin to target mid point
    this.originToTargetVector.subVectors(this.target, this.origin);
    const originToTargetDistance = this.originToTargetVector.length();
    this.originToTargetVector.normalize();

    // 3. Update frustum instance matrix
    this.originToTargetMidPoint.addVectors(this.origin, this.target).multiplyScalar(0.5);
    Telescope._dummy.position.copy(this.originToTargetMidPoint);
    Telescope._dummy.quaternion.setFromUnitVectors(Telescope.UP_VECTOR, this.originToTargetVector);
    Telescope._dummy.scale.set(1, originToTargetDistance / simulationConfig.telescope.telescopeLength, 1);
    Telescope._dummy.updateMatrix();
    frustumInstanced.setMatrixAt(this.instanceIndex, Telescope._dummy.matrix);

    // 4. Update telescope body instance matrix
    //    Bake the child rotation (PI/2 around X) and group scale (1, 1, 0.92) into the matrix
    Telescope._dummy.position.copy(this.origin);
    Telescope._dummy.up.set(0, 0, 1);
    Telescope._dummy.lookAt(this.originToTargetMidPoint);
    Telescope._dummy.scale.set(1, 1, 0.92);
    Telescope._dummy.updateMatrix();
    Telescope._tempMatrix.multiplyMatrices(Telescope._dummy.matrix, Telescope._childRotMatrix);
    telescopeInstanced.setMatrixAt(this.instanceIndex, Telescope._tempMatrix);

    // 5. Update radio arc loader (pass origin directly, no clone)
    this.radioArcLoader.update(this.origin, elapsedTime);
    this.radioArcLoader.lookAt(simulationConfig.earth.position);

    // 6. Update cube trail system
    this.updateCubeTrail(elapsedTime);
  }

  dispose(): void {
    // Clean up trail cubes
    for (let i = 0; i < this.trailCubes.length; i++) {
      this.trailGroup.remove(this.trailCubes[i].mesh);
      this.trailCubes[i].material.dispose();
    }
    this.trailCubes = [];

    // Clean up trail pool
    for (let i = 0; i < this.trailPool.length; i++) {
      this.trailPool[i].material.dispose();
    }
    this.trailPool = [];

    this.scene.remove(this.trailGroup);

    // Clean up radio arc loader
    this.radioArcLoader.dispose();
  }

  /**
   * Disposes all static shared resources.
   * Call this when the simulation is completely torn down to prevent memory leaks.
   */
  static disposeStaticResources(): void {
    if (!Telescope.hasInitializedStaticResources) return;

    Telescope.frustumMaterial?.dispose();
    Telescope.frustumMaterial = null;

    Telescope.frustumGeometry?.dispose();
    Telescope.frustumGeometry = null;

    Telescope.telescopeMaterial?.dispose();
    Telescope.telescopeMaterial = null;

    Telescope.telescopeBodyGeometry?.dispose();
    Telescope.telescopeBodyGeometry = null;

    Telescope.trailCubeGeometry?.dispose();
    Telescope.trailCubeGeometry = null;

    Telescope.hasInitializedStaticResources = false;
  }
}
