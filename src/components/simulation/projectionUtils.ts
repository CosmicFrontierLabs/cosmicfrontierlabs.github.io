import * as THREE from "three";

/**
 * Projects a world position to normalized device coordinates (NDC) using a camera
 * @param worldPosition - The world position to project
 * @param camera - The camera to use for projection
 * @returns A Vector2 representing the position in NDC space
 */
export function projectWorldToNDC(worldPosition: THREE.Vector3, camera: THREE.Camera): THREE.Vector2 {
  const projected = worldPosition.clone();
  projected.project(camera);
  return new THREE.Vector2(projected.x, projected.y);
}

/**
 * Projects multiple world positions to NDC space
 * @param worldPositions - Array of world positions to project
 * @param camera - The camera to use for projection
 * @returns Array of Vector2s representing positions in NDC space
 */
export function projectWorldPositionsToNDC(worldPositions: THREE.Vector3[], camera: THREE.Camera): THREE.Vector2[] {
  return worldPositions.map((pos) => projectWorldToNDC(pos, camera));
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
  const refNDC = projectWorldToNDC(referencePoint, camera);

  const cameraRight = new THREE.Vector3(1, 0, 0);
  cameraRight.applyQuaternion(camera.quaternion);
  cameraRight.normalize();

  const offsetPoint = referencePoint.clone().add(cameraRight.multiplyScalar(worldRadius));
  const offsetNDC = projectWorldToNDC(offsetPoint, camera);

  return refNDC.distanceTo(offsetNDC);
}
