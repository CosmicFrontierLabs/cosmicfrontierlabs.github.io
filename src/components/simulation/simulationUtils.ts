import * as THREE from "three";
// @ts-expect-error: no type definitions for 'glslify'
import glslify from "glslify";

/**
 * Draws a debug point (red sphere) at the specified position in the scene
 * @param scene - The Three.js scene to add the debug point to
 * @param position - The world position where the debug point should be placed
 * @param options - The options for the debug point
 * @param options.isFilled - Whether the debug point should be filled
 * @param options.radius - The radius of the debug point
 * @param options.fadeAfter - The time in seconds after which the debug point should fade away
 */
export function drawDebugPoint(
  scene: THREE.Scene,
  position: THREE.Vector3,
  options: { isFilled?: boolean; radius?: number; onTop?: boolean; fadeAfter?: number } = {
    isFilled: true,
    radius: 0.1,
    onTop: false,
    fadeAfter: 1.0,
  }
): void {
  const color = 0xff0000;
  const radius = options.radius ?? 0.1;
  let mesh: THREE.Mesh;
  let geometry: THREE.SphereGeometry;
  let material: THREE.MeshBasicMaterial;

  if (options.isFilled) {
    geometry = new THREE.SphereGeometry(radius, 16, 16);
    material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      side: THREE.DoubleSide,
      opacity: 0.8,
    });
    mesh = new THREE.Mesh(geometry, material);
  } else if (options.onTop) {
    geometry = new THREE.SphereGeometry(radius, 16, 16);
    material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false,
    });
    mesh = new THREE.Mesh(geometry, material);
  } else {
    // Create a sphere wireframe for a circle border visible from all angles
    geometry = new THREE.SphereGeometry(radius, 16, 16);
    material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.8,
      wireframe: true,
    });
    mesh = new THREE.Mesh(geometry, material);
  }

  mesh.position.copy(position);
  scene.add(mesh);

  // Remove the debug point after fadeAfter seconds if specified
  if (options.fadeAfter !== undefined && options.fadeAfter > 0) {
    setTimeout(() => {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    }, options.fadeAfter * 1000);
  }
}

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
  // Project the reference point to NDC
  const refNDC = projectWorldToNDC(referencePoint, camera);

  // Create a point offset by the radius in world space (using right direction)
  // We'll use the camera's right vector to ensure consistent conversion
  const cameraRight = new THREE.Vector3(1, 0, 0);
  cameraRight.applyQuaternion(camera.quaternion);
  cameraRight.normalize();

  const offsetPoint = referencePoint.clone().add(cameraRight.multiplyScalar(worldRadius));
  const offsetNDC = projectWorldToNDC(offsetPoint, camera);

  // Calculate the NDC distance
  const ndcRadius = refNDC.distanceTo(offsetNDC);

  return ndcRadius;
}

export function grid3d(center: THREE.Vector3, radius: number, numPoints: number): THREE.Vector3[] {
  // Creates a grid uniformly on the sphere defined by the center and radius
  const grid: THREE.Vector3[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < numPoints; i++) {
    const y = 1 - (i / (numPoints - 1)) * 2; // y goes from 1 to -1
    const theta = goldenAngle * i;
    const r = Math.sqrt(1 - y * y);
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    grid.push(new THREE.Vector3(center.x + radius * x, center.y + radius * y, center.z + radius * z));
  }
  return grid;
}

export function sampleArray(arr: any[], numPoints: number): any[] {
  return arr.sort(() => Math.random() - 0.5).slice(0, numPoints);
}

/**
 * Calculates the world position where a mouse ray intersects with a sphere
 * Accounts for camera movement by raycasting from camera through mouse position
 * @param mousePositionNDC - Mouse position in normalized device coordinates (-1 to 1)
 * @param camera - The camera to use for raycasting
 * @param sphereCenter - Center of the sphere
 * @param sphereRadius - Radius of the sphere
 * @returns World position where the ray intersects the sphere surface
 */
export function mouseNDCToSphereIntersection(
  mousePositionNDC: THREE.Vector2,
  camera: THREE.Camera,
  sphereCenter: THREE.Vector3,
  sphereRadius: number
): THREE.Vector3 {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mousePositionNDC, camera);

  const sphereDirection = raycaster.ray.direction.clone();
  const sphereOrigin = raycaster.ray.origin.clone();

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
    // Use the closer intersection point (smaller t)
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    mouseWorldPosition.copy(sphereOrigin).add(sphereDirection.clone().multiplyScalar(t));
  } else {
    // Fallback: project to sphere surface along ray direction
    const toCenter = sphereCenter.clone().sub(sphereOrigin);
    const projectionLength = toCenter.dot(sphereDirection);
    const projectedPoint = sphereOrigin.clone().add(sphereDirection.clone().multiplyScalar(projectionLength));
    const toProjected = projectedPoint.clone().sub(sphereCenter);
    const distance = toProjected.length();
    if (distance > 0) {
      mouseWorldPosition.copy(sphereCenter).add(toProjected.multiplyScalar(sphereRadius / distance));
    } else {
      mouseWorldPosition.copy(sphereCenter);
    }
  }

  return mouseWorldPosition;
}

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

/**
 * Calculates intersection points of a line segment with a sphere
 * @param lineStart - Start point of the line segment
 * @param lineEnd - End point of the line segment
 * @param sphereCenter - Center of the sphere
 * @param sphereRadius - Radius of the sphere
 * @returns Array of intersection points (0, 1, or 2 points)
 */
export function lineSphereIntersection(
  lineStart: THREE.Vector3,
  lineEnd: THREE.Vector3,
  sphereCenter: THREE.Vector3,
  sphereRadius: number
): THREE.Vector3[] {
  const intersections: THREE.Vector3[] = [];

  // Direction vector of the line
  const dir = new THREE.Vector3().subVectors(lineEnd, lineStart);
  const dirLength = dir.length();

  if (dirLength < 0.0001) {
    // Line segment is too short, treat as a point
    const dist = lineStart.distanceTo(sphereCenter);
    if (Math.abs(dist - sphereRadius) < 0.0001) {
      intersections.push(lineStart.clone());
    }
    return intersections;
  }

  const dirNormalized = dir.normalize();

  // Vector from sphere center to line start
  const toLineStart = new THREE.Vector3().subVectors(lineStart, sphereCenter);

  // Calculate coefficients for quadratic equation: at^2 + bt + c = 0
  const a = dirNormalized.dot(dirNormalized);
  const b = 2.0 * toLineStart.dot(dirNormalized);
  const c = toLineStart.dot(toLineStart) - sphereRadius * sphereRadius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    // No intersection
    return intersections;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);

  // Check if intersections are within the line segment (t between 0 and dirLength)
  if (t1 >= 0 && t1 <= dirLength) {
    const intersection1 = lineStart.clone().add(dirNormalized.clone().multiplyScalar(t1));
    intersections.push(intersection1);
  }

  if (t2 >= 0 && t2 <= dirLength && Math.abs(t2 - t1) > 0.0001) {
    const intersection2 = lineStart.clone().add(dirNormalized.clone().multiplyScalar(t2));
    intersections.push(intersection2);
  }

  return intersections;
}

/**
 * Checks if a ray from origin to target would pass through a sphere.
 * Returns true if the ray intersects the sphere between origin and target.
 * @param origin - Starting point of the ray
 * @param target - End point of the ray
 * @param sphereCenter - Center of the sphere
 * @param sphereRadius - Radius of the sphere
 * @returns True if the ray intersects the sphere between origin and target
 */
export function rayIntersectsSphere(
  origin: THREE.Vector3,
  target: THREE.Vector3,
  sphereCenter: THREE.Vector3,
  sphereRadius: number
): boolean {
  // Calculate direction vector from origin to target
  const dir = new THREE.Vector3().subVectors(target, origin);
  const dirLength = dir.length();

  if (dirLength < 0.0001) {
    // Ray is too short, check if origin is inside sphere
    return origin.distanceTo(sphereCenter) <= sphereRadius;
  }

  const dirNormalized = dir.normalize();

  // Vector from sphere center to ray origin
  const toOrigin = new THREE.Vector3().subVectors(origin, sphereCenter);

  // Calculate coefficients for quadratic equation: at^2 + bt + c = 0
  // where t is the parameter along the ray (0 = origin, dirLength = target)
  const a = dirNormalized.dot(dirNormalized);
  const b = 2.0 * toOrigin.dot(dirNormalized);
  const c = toOrigin.dot(toOrigin) - sphereRadius * sphereRadius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    // No intersection
    return false;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);

  // Check if either intersection point is between origin (t=0) and target (t=dirLength)
  // We want to know if the ray passes through the sphere on its way to the target
  return (t1 >= 0 && t1 <= dirLength) || (t2 >= 0 && t2 <= dirLength);
}
/**
 * Calculates a point on a local circle around a given spherical center point
 *
 * This function creates a circular motion path on the surface of a sphere by:
 * 1. Computing tangent vectors at the center point (orthogonal to the surface normal)
 * 2. Using these tangent vectors to create a circular offset in the local tangent plane
 * 3. Projecting the result back onto the sphere surface at the same radius
 *
 * The circle is parameterized by time, allowing for smooth orbital motion around
 * the center point. The function handles edge cases where the center point is at
 * the poles (vertical normal) by selecting a stable tangent direction.
 *
 * @param time - The time parameter used to calculate the angle around the circle
 * @param sphericalCenter - The center point of the circle in spherical coordinates
 * @param radius - The radius of the circle in world space units (default: 0.1)
 * @param speed - The angular speed multiplier for the circular motion (default: 1)
 * @returns A new Spherical coordinate representing a point on the circle around the center
 */
export function localCircleOnSphere(
  time: number,
  sphericalCenter: THREE.Spherical,
  radius = 0.1,
  speed = 1
): THREE.Spherical {
  // Convert spherical → cartesian
  const base = new THREE.Vector3().setFromSpherical(sphericalCenter);

  // Determine tangent vectors at the point
  const normal = base.clone().normalize();

  // Pick stable tangent directions
  const tangent1 = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0));
  if (tangent1.lengthSq() < 1e-4) {
    // If normal is vertical, pick a different axis
    tangent1.set(1, 0, 0);
  }
  tangent1.normalize();

  const tangent2 = new THREE.Vector3().crossVectors(normal, tangent1).normalize();

  // Angle around the local circle
  const a = time * speed;

  // Create the local circular offset
  const offset = tangent1.multiplyScalar(Math.cos(a) * radius).addScaledVector(tangent2, Math.sin(a) * radius);

  // Final point on the sphere (renormalized to same radius)
  const result = base.clone().add(offset).setLength(sphericalCenter.radius);

  return new THREE.Spherical().setFromVector3(result);
}

/**
 * Calculates orbital angular speed using Kepler's laws for circular orbits
 * Formula: ω = √(GM/r³) where G is gravitational constant, M is Earth mass, r is orbital radius
 * @param radius - Orbital radius from Earth center (in world units)
 * @param earthMass - Earth's mass (scaled to world units)
 * @param gravitationalConstant - Gravitational constant G (scaled to world units)
 * @returns Angular speed in radians per second
 */
export function calculateOrbitalAngularSpeed(radius: number, earthMass: number, gravitationalConstant: number): number {
  // For circular orbits: ω = √(GM/r³)
  const GM = gravitationalConstant * earthMass;
  return Math.sqrt(GM / (radius * radius * radius));
}

/**
 * Calculates orbital position for a satellite orbiting around Earth
 * Orbits in prograde direction (counter-clockwise when viewed from above, matching Earth's rotation)
 * For polar orbits (inclination ≈ π/2), the orbit passes over the north and south poles
 * @param elapsedTime - Absolute time elapsed since start
 * @param radius - Orbital radius from Earth center
 * @param speed - Angular speed (radians per second)
 * @param inclination - Orbital inclination angle (radians, 0 = equatorial, π/2 = polar)
 * @param phase - Initial phase offset (radians)
 * @param longitudeOfAscendingNode - Rotation around y-axis to spread out orbital planes (radians)
 * @param earthCenter - Center position of Earth (default: origin)
 * @returns Vector3 position of satellite in world space
 */
export function calculateOrbitalPosition(
  elapsedTime: number,
  radius: number,
  speed: number,
  inclination: number,
  phase: number,
  longitudeOfAscendingNode: number,
  earthCenter: THREE.Vector3
): THREE.Vector3 {
  const angle = elapsedTime * speed + phase;

  // Check if this is a polar orbit (inclination ≈ π/2)
  const isPolarOrbit = Math.abs(inclination - Math.PI / 2) < 0.15;

  if (isPolarOrbit) {
    // For polar orbits: orbit in a plane containing the y-axis (poles)
    // Start in yz-plane, which passes through both poles
    // The orbit goes: north pole → equator → south pole → equator → north pole
    const x = 0;
    const y = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    const position = new THREE.Vector3(x, y, z);

    // First rotate around y-axis by longitude of ascending node to spread out orbital planes
    // This prevents all telescopes from being aligned in the same plane
    if (Math.abs(longitudeOfAscendingNode) > 0.001) {
      const nodeRotationMatrix = new THREE.Matrix4().makeRotationY(longitudeOfAscendingNode);
      position.applyMatrix4(nodeRotationMatrix);
    }

    // Then rotate around x-axis by inclination variation
    // This allows slight variation in the orbital plane while maintaining polar characteristics
    const inclinationVariation = inclination - Math.PI / 2;
    if (Math.abs(inclinationVariation) > 0.001) {
      const inclinationRotationMatrix = new THREE.Matrix4().makeRotationX(inclinationVariation);
      position.applyMatrix4(inclinationRotationMatrix);
    }

    // Translate to Earth center
    return position.add(earthCenter);
  } else {
    // For non-polar orbits: start in equatorial plane (xz-plane, since Earth rotates around y-axis)
    const x = radius * Math.cos(angle);
    const y = 0;
    const z = radius * Math.sin(angle);
    const position = new THREE.Vector3(x, y, z);

    // Apply inclination rotation around x-axis
    if (Math.abs(inclination) > 0.001) {
      const rotationMatrix = new THREE.Matrix4().makeRotationX(inclination);
      position.applyMatrix4(rotationMatrix);
    }

    // Translate to Earth center
    return position.add(earthCenter);
  }
}

export const GrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1024, 1024) },
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: glslify(`
    #pragma glslify: grain = require(glsl-film-grain)

    #define GRAIN_SIZE 0.1
    #define GRAIN_AMOUNT 0.01

    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;

    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Commenting out the redshift because it was making white colors too blue
      // vec4 redShift = texture2D(tDiffuse, vUv + vec2(0.001, -0.001));
      // vec3 shiftedColor = vec3(redShift.r, color.g, color.b);

      vec3 shiftedColor = color.rgb; // Use original color, redshift commented out
      float g = grain(vUv, uResolution / GRAIN_SIZE);
      shiftedColor += (g - 0.5) * GRAIN_AMOUNT;
      gl_FragColor = vec4(shiftedColor, color.a);
    }
  `),
};
