import * as THREE from "three";

/**
 * Tracks mouse position and provides methods to calculate intersections with spheres.
 * Should be updated each frame with the current mouse position and camera.
 *
 * All temporary vectors are pre-allocated to avoid per-frame GC pressure.
 */
export class MouseTracker {
  private mousePositionNDC: THREE.Vector2;
  private camera: THREE.Camera | null = null;
  private raycaster: THREE.Raycaster;

  // Pre-allocated temporaries for getIntersectionWithSphere
  private _oc = new THREE.Vector3();
  private _sphereDir = new THREE.Vector3();
  private _sphereOrigin = new THREE.Vector3();
  private _mouseWorldResult = new THREE.Vector3();
  private _toCenter = new THREE.Vector3();
  private _projectedPoint = new THREE.Vector3();
  private _toProjected = new THREE.Vector3();

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
   * Calculates the world position where the mouse ray intersects with a sphere.
   * Only tracks intersection with the hemisphere that's farther away from the camera.
   * Writes result into the provided `out` Vector3 to avoid allocations.
   * @param sphereCenter - Center of the sphere
   * @param sphereRadius - Radius of the sphere
   * @param out - Pre-allocated Vector3 to write result into
   */
  getIntersectionWithSphere(sphereCenter: THREE.Vector3, sphereRadius: number, out: THREE.Vector3): void {
    if (!this.camera) {
      out.copy(sphereCenter);
      return;
    }

    this._sphereDir.copy(this.raycaster.ray.direction);
    this._sphereOrigin.copy(this.raycaster.ray.origin);

    // Calculate intersection: ray origin + t * direction = point on sphere
    // |point - center|^2 = radius^2
    // Solve quadratic: at^2 + bt + c = 0
    this._oc.copy(this._sphereOrigin).sub(sphereCenter);
    const a = this._sphereDir.dot(this._sphereDir);
    const b = 2 * this._oc.dot(this._sphereDir);
    const c = this._oc.dot(this._oc) - sphereRadius * sphereRadius;
    const discriminant = b * b - 4 * a * c;

    if (discriminant >= 0) {
      // Calculate both intersection points
      const sqrtDiscriminant = Math.sqrt(discriminant);
      const t1 = (-b - sqrtDiscriminant) / (2 * a);
      const t2 = (-b + sqrtDiscriminant) / (2 * a);

      // Use the farther intersection point (larger t) - this is on the back hemisphere
      const t = Math.max(t1, t2);
      out.copy(this._sphereOrigin).addScaledVector(this._sphereDir, t);
    } else {
      // Fallback: project to sphere surface along ray direction
      // For the far hemisphere, we need to project to the far side
      this._toCenter.copy(sphereCenter).sub(this._sphereOrigin);
      const projectionLength = this._toCenter.dot(this._sphereDir);
      this._projectedPoint.copy(this._sphereOrigin).addScaledVector(this._sphereDir, projectionLength);
      this._toProjected.copy(this._projectedPoint).sub(sphereCenter);
      const distance = this._toProjected.length();
      if (distance > 0) {
        // Project to the far side of the sphere
        this._toProjected.multiplyScalar(sphereRadius / distance);
        this._mouseWorldResult.copy(sphereCenter).add(this._toProjected);
        // Check if this point is on the far hemisphere (farther from camera than sphere center)
        const cameraToCenter = sphereCenter.distanceTo(this._sphereOrigin);
        const cameraToFarPoint = this._mouseWorldResult.distanceTo(this._sphereOrigin);
        if (cameraToFarPoint > cameraToCenter) {
          out.copy(this._mouseWorldResult);
        } else {
          // Use the opposite point on the sphere
          this._toProjected.multiplyScalar(-1);
          out.copy(sphereCenter).add(this._toProjected);
        }
      } else {
        out.copy(sphereCenter);
      }
    }
  }
}
