import * as THREE from "three";

/**
 * Tracks mouse position and provides methods to calculate intersections with spheres
 * Should be updated each frame with the current mouse position and camera
 */
export class MouseTracker {
  private mousePositionNDC: THREE.Vector2;
  private camera: THREE.Camera | null = null;
  private raycaster: THREE.Raycaster;

  constructor() {
    this.mousePositionNDC = new THREE.Vector2(0, 0);
    this.raycaster = new THREE.Raycaster();
  }

  /**
   * Updates the mouse position in normalized device coordinates
   * Should be called when the mouse moves
   * @param x - X coordinate in NDC space (-1 to 1)
   * @param y - Y coordinate in NDC space (-1 to 1)
   */
  updateMousePositionNDC(x: number, y: number): void {
    this.mousePositionNDC.set(x, y);
  }

  /**
   * Updates the mouse tracker with the current camera
   * Should be called each frame to account for camera movement
   * @param camera - The camera to use for raycasting
   */
  update(camera: THREE.Camera): void {
    this.camera = camera;
    this.raycaster.setFromCamera(this.mousePositionNDC, camera);
  }

  /**
   * Calculates the world position where the mouse ray intersects with a sphere
   * Only tracks intersection with the hemisphere that's farther away from the camera
   * @param sphereCenter - Center of the sphere
   * @param sphereRadius - Radius of the sphere
   * @returns World position where the ray intersects the sphere surface on the far hemisphere
   */
  getIntersectionWithSphere(sphereCenter: THREE.Vector3, sphereRadius: number): THREE.Vector3 {
    if (!this.camera) {
      // Fallback if camera hasn't been set yet
      return sphereCenter.clone();
    }

    const sphereDirection = this.raycaster.ray.direction.clone();
    const sphereOrigin = this.raycaster.ray.origin.clone();

    // Calculate intersection: ray origin + t * direction = point on sphere
    // |point - center|^2 = radius^2
    // Solve quadratic: at^2 + bt + c = 0
    const oc = sphereOrigin.clone().sub(sphereCenter);
    const a = sphereDirection.dot(sphereDirection);
    const b = 2 * oc.dot(sphereDirection);
    const c = oc.dot(oc) - sphereRadius * sphereRadius;
    const discriminant = b * b - 4 * a * c;

    const mouseWorldPosition = new THREE.Vector3();
    if (discriminant >= 0) {
      // Calculate both intersection points
      const sqrtDiscriminant = Math.sqrt(discriminant);
      const t1 = (-b - sqrtDiscriminant) / (2 * a);
      const t2 = (-b + sqrtDiscriminant) / (2 * a);

      // Use the farther intersection point (larger t) - this is on the back hemisphere
      const t = Math.max(t1, t2);
      mouseWorldPosition.copy(sphereOrigin).add(sphereDirection.clone().multiplyScalar(t));
    } else {
      // Fallback: project to sphere surface along ray direction
      // For the far hemisphere, we need to project to the far side
      const toCenter = sphereCenter.clone().sub(sphereOrigin);
      const projectionLength = toCenter.dot(sphereDirection);
      const projectedPoint = sphereOrigin.clone().add(sphereDirection.clone().multiplyScalar(projectionLength));
      const toProjected = projectedPoint.clone().sub(sphereCenter);
      const distance = toProjected.length();
      if (distance > 0) {
        // Project to the far side of the sphere
        const farPoint = sphereCenter.clone().add(toProjected.multiplyScalar(sphereRadius / distance));
        // Check if this point is on the far hemisphere (farther from camera than sphere center)
        const cameraToCenter = sphereCenter.clone().sub(sphereOrigin).length();
        const cameraToFarPoint = farPoint.clone().sub(sphereOrigin).length();
        if (cameraToFarPoint > cameraToCenter) {
          mouseWorldPosition.copy(farPoint);
        } else {
          // Use the opposite point on the sphere
          mouseWorldPosition.copy(sphereCenter).add(toProjected.multiplyScalar(-sphereRadius / distance));
        }
      } else {
        mouseWorldPosition.copy(sphereCenter);
      }
    }

    return mouseWorldPosition;
  }
}
