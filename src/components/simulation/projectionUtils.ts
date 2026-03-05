import * as THREE from "three";

// --- Pre-allocated temporaries to avoid per-call allocations ---
const _projTemp = new THREE.Vector3();
const _cameraRight = new THREE.Vector3();
const _offsetPoint = new THREE.Vector3();
const _refNDC = new THREE.Vector2();
const _offsetNDC = new THREE.Vector2();

/**
 * Projects a world position to normalized device coordinates (NDC) using a camera.
 * Writes the result into `out` to avoid allocations.
 * @param worldPosition - The world position to project
 * @param camera - The camera to use for projection
 * @param out - Pre-allocated Vector2 to write the result into
 */
export function projectWorldToNDC(worldPosition: THREE.Vector3, camera: THREE.Camera, out: THREE.Vector2): void {
  _projTemp.copy(worldPosition).project(camera);
  out.set(_projTemp.x, _projTemp.y);
}

/**
 * Projects multiple world positions to NDC space, writing into pre-allocated output array.
 * @param worldPositions - Array of world positions to project
 * @param camera - The camera to use for projection
 * @param out - Pre-allocated array of Vector2s (must have at least worldPositions.length elements)
 * @param count - Number of positions to project (defaults to worldPositions.length)
 * @returns The number of positions projected
 */
export function projectWorldPositionsToNDC(
  worldPositions: THREE.Vector3[],
  camera: THREE.Camera,
  out: THREE.Vector2[],
  count?: number
): number {
  const n = count ?? worldPositions.length;
  for (let i = 0; i < n; i++) {
    projectWorldToNDC(worldPositions[i], camera, out[i]);
  }
  return n;
}

/**
 * Converts a world space radius to NDC space radius using camera projection
 * @param worldRadius - The radius in world space units
 * @param referencePoint - A world position to use as reference (typically a frustum destination)
 * @param camera - The camera to use for projection
 * @returns The radius in NDC space
 */
export function convertWorldRadiusToNDC(
  worldRadius: number,
  referencePoint: THREE.Vector3,
  camera: THREE.Camera
): number {
  projectWorldToNDC(referencePoint, camera, _refNDC);

  _cameraRight.set(1, 0, 0);
  _cameraRight.applyQuaternion(camera.quaternion);
  _cameraRight.normalize();

  _offsetPoint.copy(referencePoint).addScaledVector(_cameraRight, worldRadius);
  projectWorldToNDC(_offsetPoint, camera, _offsetNDC);

  return _refNDC.distanceTo(_offsetNDC);
}
