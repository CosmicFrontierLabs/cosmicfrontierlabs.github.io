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
  const dir = new THREE.Vector3().subVectors(target, origin);
  const dirLength = dir.length();

  if (dirLength < 0.0001) {
    return origin.distanceTo(sphereCenter) <= sphereRadius;
  }

  const dirNormalized = dir.normalize();
  const toOrigin = new THREE.Vector3().subVectors(origin, sphereCenter);

  const a = dirNormalized.dot(dirNormalized);
  const b = 2.0 * toOrigin.dot(dirNormalized);
  const c = toOrigin.dot(toOrigin) - sphereRadius * sphereRadius;

  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return false;
  }

  const sqrtDiscriminant = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDiscriminant) / (2 * a);
  const t2 = (-b + sqrtDiscriminant) / (2 * a);

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
 * Calculates orbital position for a satellite orbiting around Earth
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
    const x = 0;
    const y = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    const position = new THREE.Vector3(x, y, z);

    if (Math.abs(longitudeOfAscendingNode) > 0.001) {
      const nodeRotationMatrix = new THREE.Matrix4().makeRotationY(longitudeOfAscendingNode);
      position.applyMatrix4(nodeRotationMatrix);
    }

    const inclinationVariation = inclination - Math.PI / 2;
    if (Math.abs(inclinationVariation) > 0.001) {
      const inclinationRotationMatrix = new THREE.Matrix4().makeRotationX(inclinationVariation);
      position.applyMatrix4(inclinationRotationMatrix);
    }

    return position.add(earthCenter);
  } else {
    const x = radius * Math.cos(angle);
    const y = 0;
    const z = radius * Math.sin(angle);
    const position = new THREE.Vector3(x, y, z);

    if (Math.abs(inclination) > 0.001) {
      const rotationMatrix = new THREE.Matrix4().makeRotationX(inclination);
      position.applyMatrix4(rotationMatrix);
    }

    return position.add(earthCenter);
  }
}
