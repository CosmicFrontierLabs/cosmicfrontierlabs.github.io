import * as THREE from "three";
import { simulationConfig } from "./simulationConfig";

function normalizeValue(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

export class ArcLoader {
  private group: THREE.Group;
  private tempDir: THREE.Vector3;
  private tempLocalMiddleDir: THREE.Vector3;
  private animationPhaseOffset: number;

  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    // Initialize reusable temporary vectors
    this.tempDir = new THREE.Vector3();
    // Local direction to middle of arc (at π/6 angle): (cos(π/6), sin(π/6), 0) = (√3/2, 1/2, 0)
    this.tempLocalMiddleDir = new THREE.Vector3(Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0);
    // const color = 0xf32f2d;
    const color = simulationConfig.baseColor;
    const numBars = 4;
    const tubeRadius = 0.002;
    const arcRadiusScalar = 0.01;
    this.group = new THREE.Group();
    this.animationPhaseOffset = Math.random() * 1000 * 10; // Between 0 and 10 seconds

    for (let i = 0; i < numBars; i++) {
      const arcRadius = i * arcRadiusScalar;
      const arc = new THREE.ArcCurve(0, 0, arcRadius, 0, Math.PI / 3, false);
      const points2d = arc.getPoints(100) as THREE.Vector2[];
      const points3d = points2d.map((point) => new THREE.Vector3(point.x, point.y, 0));
      const curve = new THREE.CatmullRomCurve3(points3d);

      const tubeGeometry = new THREE.TubeGeometry(curve, 16, tubeRadius, 8, false);
      const tubeMaterial = new THREE.MeshToonMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthTest: true,
        depthWrite: false,
      });
      const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
      this.group.add(tubeMesh);
    }

    // this.group.position.copy(new THREE.Vector3(0, 0, 0));
    this.group.position.copy(position);
    scene.add(this.group);
  }

  lookAt(target: THREE.Vector3): void {
    // Calculate direction from group position to target
    this.tempDir.subVectors(target, this.group.position);

    // If direction is zero or very small, don't rotate
    if (this.tempDir.lengthSq() < 0.0001) {
      return;
    }

    // Normalize the target direction
    this.tempDir.normalize();

    // Rotate the group so the local middle direction aligns with the target direction
    // Using quaternion.setFromUnitVectors to rotate from local middle direction to target direction
    this.group.quaternion.setFromUnitVectors(this.tempLocalMiddleDir, this.tempDir);
  }

  update(position: THREE.Vector3, elapsedTime: number): void {
    elapsedTime += this.animationPhaseOffset;
    const animationDuration = 6;
    const animationDelay = 12;
    const totalCycleDuration = animationDuration + animationDelay;

    const cycleTime = elapsedTime % totalCycleDuration;
    const animationT = cycleTime / animationDuration;

    // If in delay period, hide everything; otherwise animate
    const isAnimating = animationT < 1.0;
    const fadeT = isAnimating ? THREE.MathUtils.clamp(animationT * 1.5, 0, 1.0) : 0;

    for (let i = 0; i < this.group.children.length; i++) {
      const tubeMesh = this.group.children[i] as THREE.Mesh;
      const material = tubeMesh.material as THREE.MeshBasicMaterial;

      if (!isAnimating) {
        material.opacity = 0;
        continue;
      }

      const curBarTStart = i / this.group.children.length;
      const barT = normalizeValue(fadeT - curBarTStart, 0, 0.25);
      let materialOpacity = THREE.MathUtils.clamp(barT, 0, 1.0);

      // Fade out in the final 0.1 of animationT
      if (animationT >= 0.9) {
        materialOpacity *= THREE.MathUtils.clamp((1.0 - animationT) / 0.1, 0, 1);
      }
      material.opacity = materialOpacity;
    }
    this.group.position.copy(position);
  }
}
