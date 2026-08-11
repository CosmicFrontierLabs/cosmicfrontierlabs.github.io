import * as THREE from "three";

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

export function sampleArray<T>(arr: T[], numPoints: number): T[] {
  return arr.sort(() => Math.random() - 0.5).slice(0, numPoints);
}

// --- Pre-allocated temporaries for lineSphereIntersection ---
const _lsi_dir = new THREE.Vector3();
const _lsi_toLineStart = new THREE.Vector3();
const _lsi_intersection = new THREE.Vector3();

/**
 * Calculates intersection points of a line segment with a sphere.
 * Writes results into the provided `out` array (up to 2 entries) and returns the count.
 * The caller must pre-allocate `out` with at least 2 Vector3 elements.
 *
 * @param lineStart - Start point of the line segment
 * @param lineEnd - End point of the line segment
 * @param sphereCenter - Center of the sphere
 * @param sphereRadius - Radius of the sphere
 * @param out - Pre-allocated array of Vector3 to write results into
 * @returns Number of intersection points written (0, 1, or 2)
 */
export function lineSphereIntersection(
  lineStart: THREE.Vector3,
  lineEnd: THREE.Vector3,
  sphereCenter: THREE.Vector3,
  sphereRadius: number,
  out: THREE.Vector3[]
): number {
  let count = 0;

  // Direction vector of the line
  _lsi_dir.subVectors(lineEnd, lineStart);
  const dirLength = _lsi_dir.length();

  if (dirLength < 0.0001) {
    // Line segment is too short, treat as a point
    const dist = lineStart.distanceTo(sphereCenter);
    if (Math.abs(dist - sphereRadius) < 0.0001) {
      out[0].copy(lineStart);
      count = 1;
    }
    return count;
  }

  // Normalize in place (dir is already a temp)
  _lsi_dir.divideScalar(dirLength);

  // Vector from sphere center to line start
  _lsi_toLineStart.subVectors(lineStart, sphereCenter);

  // Calculate coefficients for quadratic equation: at^2 + bt + c = 0
  const a = _lsi_dir.dot(_lsi_dir);
  const b = 2.0 * _lsi_toLineStart.dot(_lsi_dir);
  const c = _lsi_toLineStart.dot(_lsi_toLineStart) - sphereRadius * sphereRadius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return 0;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);

  // Check if intersections are within the line segment (t between 0 and dirLength)
  if (t1 >= 0 && t1 <= dirLength) {
    _lsi_intersection.copy(lineStart).addScaledVector(_lsi_dir, t1);
    out[count].copy(_lsi_intersection);
    count++;
  }

  if (t2 >= 0 && t2 <= dirLength && Math.abs(t2 - t1) > 0.0001) {
    _lsi_intersection.copy(lineStart).addScaledVector(_lsi_dir, t2);
    out[count].copy(_lsi_intersection);
    count++;
  }

  return count;
}

// --- Pre-allocated temporaries for rayIntersectsSphere ---
const _ris_dir = new THREE.Vector3();
const _ris_toOrigin = new THREE.Vector3();

/**
 * Checks if a ray from origin to target would pass through a sphere.
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
  _ris_dir.subVectors(target, origin);
  const dirLength = _ris_dir.length();

  if (dirLength < 0.0001) {
    return origin.distanceTo(sphereCenter) <= sphereRadius;
  }

  _ris_dir.divideScalar(dirLength);
  _ris_toOrigin.subVectors(origin, sphereCenter);

  const a = _ris_dir.dot(_ris_dir);
  const b = 2.0 * _ris_toOrigin.dot(_ris_dir);
  const c = _ris_toOrigin.dot(_ris_toOrigin) - sphereRadius * sphereRadius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return false;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);

  return (t1 >= 0 && t1 <= dirLength) || (t2 >= 0 && t2 <= dirLength);
}

// --- Pre-allocated temporaries for localCircleOnSphere ---
const _lcos_base = new THREE.Vector3();
const _lcos_normal = new THREE.Vector3();
const _lcos_tangent1 = new THREE.Vector3();
const _lcos_tangent2 = new THREE.Vector3();
const _lcos_result = new THREE.Vector3();
const _lcos_upRef = new THREE.Vector3(0, 1, 0);

/**
 * Calculates a point on a local circle around a given spherical center point.
 * Writes the result into the provided `outSpherical` to avoid allocations.
 *
 * @param time - The time parameter used to calculate the angle around the circle
 * @param sphericalCenter - The center point of the circle in spherical coordinates
 * @param outSpherical - Pre-allocated Spherical to write result into
 * @param radius - The radius of the circle in world space units (default: 0.1)
 * @param speed - The angular speed multiplier for the circular motion (default: 1)
 */
export function localCircleOnSphere(
  time: number,
  sphericalCenter: THREE.Spherical,
  outSpherical: THREE.Spherical,
  radius = 0.1,
  speed = 1
): void {
  // Convert spherical → cartesian
  _lcos_base.setFromSpherical(sphericalCenter);

  // Determine tangent vectors at the point
  _lcos_normal.copy(_lcos_base).normalize();

  // Pick stable tangent directions
  _lcos_tangent1.crossVectors(_lcos_normal, _lcos_upRef);
  if (_lcos_tangent1.lengthSq() < 1e-4) {
    _lcos_tangent1.set(1, 0, 0);
  }
  _lcos_tangent1.normalize();

  _lcos_tangent2.crossVectors(_lcos_normal, _lcos_tangent1).normalize();

  // Angle around the local circle
  const a = time * speed;

  // Create the local circular offset and add to base
  // offset = tangent1 * cos(a) * radius + tangent2 * sin(a) * radius
  _lcos_tangent1.multiplyScalar(Math.cos(a) * radius);
  _lcos_tangent1.addScaledVector(_lcos_tangent2, Math.sin(a) * radius);

  // Final point on the sphere (renormalized to same radius)
  _lcos_result.copy(_lcos_base).add(_lcos_tangent1).setLength(sphericalCenter.radius);

  outSpherical.setFromVector3(_lcos_result);
}

// --- Pre-allocated temporaries for calculateOrbitalPosition ---
const _cop_position = new THREE.Vector3();
const _cop_matrix = new THREE.Matrix4();

/**
 * Calculates orbital position for a satellite orbiting around Earth.
 * Writes result into the provided `out` Vector3 to avoid allocations.
 *
 * @param elapsedTime - Absolute time elapsed since start
 * @param radius - Orbital radius from Earth center
 * @param speed - Angular speed (radians per second)
 * @param inclination - Orbital inclination angle (radians, 0 = equatorial, π/2 = polar)
 * @param phase - Initial phase offset (radians)
 * @param longitudeOfAscendingNode - Rotation around y-axis to spread out orbital planes (radians)
 * @param earthCenter - Center position of Earth (default: origin)
 * @param out - Pre-allocated Vector3 to write result into
 */
export function calculateOrbitalPosition(
  elapsedTime: number,
  radius: number,
  speed: number,
  inclination: number,
  phase: number,
  longitudeOfAscendingNode: number,
  earthCenter: THREE.Vector3,
  out: THREE.Vector3
): void {
  const angle = elapsedTime * speed + phase;

  // Check if this is a polar orbit (inclination ≈ π/2)
  const isPolarOrbit = Math.abs(inclination - Math.PI / 2) < 0.15;

  if (isPolarOrbit) {
    _cop_position.set(0, radius * Math.cos(angle), radius * Math.sin(angle));

    if (Math.abs(longitudeOfAscendingNode) > 0.001) {
      _cop_matrix.makeRotationY(longitudeOfAscendingNode);
      _cop_position.applyMatrix4(_cop_matrix);
    }

    const inclinationVariation = inclination - Math.PI / 2;
    if (Math.abs(inclinationVariation) > 0.001) {
      _cop_matrix.makeRotationX(inclinationVariation);
      _cop_position.applyMatrix4(_cop_matrix);
    }

    out.copy(_cop_position).add(earthCenter);
  } else {
    _cop_position.set(radius * Math.cos(angle), 0, radius * Math.sin(angle));

    if (Math.abs(inclination) > 0.001) {
      _cop_matrix.makeRotationX(inclination);
      _cop_position.applyMatrix4(_cop_matrix);
    }

    out.copy(_cop_position).add(earthCenter);
  }
}
