import * as THREE from "three";
import { localCircleOnSphere, calculateOrbitalPosition, rayIntersectsSphere } from "./simulationUtils";
import { simulationConfig } from "./simulationConfig";
import { ArcLoader } from "./ArcLoader";

/**
 * Represents a telescope in 3D space.
 * Used to visualize viewing volumes or light cones.
 */
export class Telescope {
  // Static shared resources for better performance
  static hasInitializedStaticResources: boolean = false;
  static frustumMaterial: THREE.MeshBasicMaterial | null = null;
  static frustumGeometry: THREE.CylinderGeometry | null = null;
  static telescopeMaterial: THREE.MeshBasicMaterial | null = null;
  static telescopeGroup: THREE.Group | null = null;
  static trailMaterial: THREE.MeshBasicMaterial | null = null;
  static trailCubeGeometry: THREE.BoxGeometry | null = null;

  scene: THREE.Scene;
  frustumMesh: THREE.Mesh;
  telescopeMesh: THREE.Group;

  origin: THREE.Vector3;
  target: THREE.Vector3;

  radioArcLoader: ArcLoader;
  orbitalRadius: number;
  orbitalSpeed: number;
  inclination: number;
  initialPhase: number;
  longitudeOfAscendingNode: number; // Rotation around y-axis to spread out orbital planes
  earthCenter: THREE.Vector3;
  shouldTrackMouse: boolean;

  // Trail system properties
  trailGroup: THREE.Group;
  trailCubes: Array<{ mesh: THREE.Mesh; createdAt: number }>;
  lastTrailSpawnTime: number;
  trailDuration: number = 3.5; // seconds
  trailSpawnInterval: number = 0.15; // seconds

  // Reusable temporary objects to avoid allocations in update loop
  tempSpherical: THREE.Spherical;
  tempTargetSpherical: THREE.Spherical;
  originToTargetVector: THREE.Vector3;
  originToTargetMidPoint: THREE.Vector3;

  constructor(scene: THREE.Scene, origin: THREE.Vector3, shouldTrackMouse: boolean) {
    this.scene = scene;
    // 1. Initialize static resources
    this.initializeStaticResources();

    // 2. Initialize reusable temporary objects
    this.tempSpherical = new THREE.Spherical();
    this.tempTargetSpherical = new THREE.Spherical();
    this.originToTargetVector = new THREE.Vector3();
    this.originToTargetMidPoint = new THREE.Vector3();

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
    // Polar orbit: inclination ≈ 90° (π/2 radians) with variation for visual interest
    this.inclination = Math.PI / 2 + (Math.random() - 0.5) * 0.2; // ±11.5° variation
    // Longitude of ascending node: rotates orbital plane around y-axis to spread out telescopes
    this.longitudeOfAscendingNode = Math.random() * Math.PI * 2; // Full 360° variation
    // Initial phase: position along the orbit
    this.initialPhase = Math.random() * Math.PI * 2;
    this.earthCenter = simulationConfig.earth.position.clone();
    this.shouldTrackMouse = shouldTrackMouse;

    // Initialize trail system before update() is called
    this.trailGroup = new THREE.Group();
    this.trailCubes = [];
    this.lastTrailSpawnTime = 0;
    this.scene.add(this.trailGroup);

    this.frustumMesh = new THREE.Mesh(Telescope.frustumGeometry!, Telescope.frustumMaterial!);
    this.frustumMesh.renderOrder = 0;
    this.update(0, new THREE.Vector3(0, 0, 0));
    this.scene.add(this.frustumMesh);

    // Clone the shared telescope group
    this.telescopeMesh = Telescope.telescopeGroup!.clone();
    this.scene.add(this.telescopeMesh);

    // Set up so z+ is "up" for correct orientation when facing the midpoint
    this.telescopeMesh.up.set(0, 0, 1);

    this.radioArcLoader = new ArcLoader(this.scene, origin.clone());
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
      32,
      1,
      false
    );

    // 3. Initialize telescope and trail materials
    Telescope.telescopeMaterial = new THREE.MeshBasicMaterial({ color: simulationConfig.baseColor });
    Telescope.trailMaterial = new THREE.MeshBasicMaterial({
      color: simulationConfig.baseColor,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });

    // 4. Initialize telescope body geometry
    Telescope.telescopeGroup = new THREE.Group();
    const radius = simulationConfig.telescope.telescopeWidth;
    const bodyGeometry = new THREE.BoxGeometry(radius, radius, radius);
    const bodyMesh = new THREE.Mesh(bodyGeometry, Telescope.telescopeMaterial!);
    bodyMesh.rotation.x = Math.PI / 2; // Rotate "box" to extend along z-axis
    Telescope.telescopeGroup.add(bodyMesh);
    Telescope.telescopeGroup.scale.set(1, 1, 0.92);

    // 5. Initialize trail cube geometry
    const cubeSize = simulationConfig.telescope.telescopeWidth * 0.25;
    Telescope.trailCubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  }

  /**
   * Updates the target position based on mouse tracking or normal orbital behavior.
   * @param elapsedTime - Time elapsed since simulation start
   * @param mouseWorldPosition - Optional mouse position in world coordinates (used when shouldTrackMouse is true)
   */
  private updateOriginAndTarget(elapsedTime: number, mouseWorldPosition: THREE.Vector3): void {
    // 1. Update origin
    this.origin = calculateOrbitalPosition(
      elapsedTime,
      this.orbitalRadius,
      this.orbitalSpeed,
      this.inclination,
      this.initialPhase,
      this.longitudeOfAscendingNode,
      this.earthCenter
    );

    // 2. Check if mouse tracking is enabled and mouse position is available
    let useMousePosition = false;
    if (this.shouldTrackMouse && mouseWorldPosition) {
      // Check if the ray from origin to mouseWorldPosition would pass through Earth
      // If it does, don't use the mouse position (keep the original target)
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
      // Lerp target towards the mouse world position
      this.target = this.target.clone().lerp(mouseWorldPosition, 0.01);
      return;
    }

    // 4. Update target based on current origin position (normal behavior)
    this.tempSpherical.setFromVector3(this.origin);
    this.tempTargetSpherical.set(
      simulationConfig.background.geometry.radius,
      this.tempSpherical.phi,
      this.tempSpherical.theta
    );
    const targetSpherical = localCircleOnSphere(
      elapsedTime,
      this.tempTargetSpherical,
      simulationConfig.background.circleRadius,
      simulationConfig.telescope.frustumTargetSpeed
    );

    // 5. Calculate the desired target position and lerp towards it
    const desiredTarget = new THREE.Vector3().setFromSpherical(targetSpherical);
    // Lerp target gradually towards the desired position to avoid snapping
    this.target = this.target.clone().lerp(desiredTarget, 0.01);
  }

  /**
   * Updates the trail system: creates new trail cubes at intervals and fades out old ones.
   * @param elapsedTime - Time elapsed since simulation start
   */
  private updateCubeTrail(elapsedTime: number): void {
    // 1. Safety check: ensure trail system is initialized
    if (!this.trailCubes || !this.trailGroup) {
      return;
    }

    // 2. Create new trail cube at fixed intervals
    if (elapsedTime - this.lastTrailSpawnTime >= this.trailSpawnInterval) {
      // Reuse shared geometry, but clone material so each cube can have its own opacity
      const cubeMesh = new THREE.Mesh(Telescope.trailCubeGeometry!, Telescope.trailMaterial!.clone());
      cubeMesh.position.copy(this.origin);
      this.trailGroup.add(cubeMesh);
      this.trailCubes.push({
        mesh: cubeMesh,
        createdAt: elapsedTime,
      });
      this.lastTrailSpawnTime = elapsedTime;
    }

    // 3. Update opacity and remove old cubes
    const currentTime = elapsedTime;
    for (let i = this.trailCubes.length - 1; i >= 0; i--) {
      const trailCube = this.trailCubes[i];
      const age = currentTime - trailCube.createdAt;

      if (age >= this.trailDuration) {
        // Remove cube if it's older than trail duration
        this.trailGroup.remove(trailCube.mesh);
        // Only dispose material (geometry is shared and shouldn't be disposed)
        (trailCube.mesh.material as THREE.Material).dispose();
        this.trailCubes.splice(i, 1);
      } else {
        // Fade out based on age (linear fade from 1.0 to 0.0 over trailDuration)
        const opacity = 1.0 - age / this.trailDuration;
        (trailCube.mesh.material as THREE.MeshBasicMaterial).opacity = opacity;
      }
    }
  }

  /**
   * Updates the telescope mesh position and orientation based on current origin and destination.
   * @param elapsedTime - Time elapsed since simulation start
   * @param mouseWorldPosition - Optional mouse position in world coordinates (used when shouldTrackMouse is true)
   */
  update(elapsedTime: number, mouseWorldPosition: THREE.Vector3): void {
    if (!this.telescopeMesh || !this.frustumMesh) {
      return;
    }

    // 1. Update origin (the orbital position of the telescope)
    this.updateOriginAndTarget(elapsedTime, mouseWorldPosition);

    // 2. Calculate origin to target vector and origin to target mid point
    this.originToTargetVector.subVectors(this.target, this.origin);
    const originToTargetDistance = this.originToTargetVector.length(); // Get distance before normalization
    this.originToTargetVector.normalize();

    // 3. Update frustum
    this.originToTargetMidPoint.addVectors(this.origin, this.target).multiplyScalar(0.5);
    this.frustumMesh.position.copy(this.originToTargetMidPoint);
    this.frustumMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.originToTargetVector);
    this.frustumMesh.scale.y = originToTargetDistance / simulationConfig.telescope.telescopeLength;

    // 4. Update telescope mesh
    this.telescopeMesh.position.copy(this.origin);
    this.telescopeMesh.lookAt(this.originToTargetMidPoint);

    // 5. Update radio arc loader
    this.radioArcLoader.update(this.origin.clone(), elapsedTime);
    this.radioArcLoader.lookAt(simulationConfig.earth.position.clone());

    // 6. Update cube trail system
    this.updateCubeTrail(elapsedTime);
  }

  dispose(): void {
    // Clean up trail cubes
    this.trailCubes.forEach((trailCube) => {
      this.trailGroup.remove(trailCube.mesh);
      // Only dispose material (geometry is shared and shouldn't be disposed)
      (trailCube.mesh.material as THREE.Material).dispose();
    });
    this.trailCubes = [];
    this.scene.remove(this.trailGroup);
  }
}
