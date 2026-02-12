import * as THREE from "three";

// --- Brighten-dark-materials tunable parameters ---
interface BrightenParams {
  minLuminance: number;
  metallicLumTarget: number;
  maxBoostFactor: number;
  minChannelFraction: number;
  metallicThreshold: number;
  maxMetalness: number;
  texturedMetalnessThreshold: number;
  texturedEmissive: number;
  highMetalnessThreshold: number;
  highRoughnessThreshold: number;
  extremeRoughness: number;
  whiteMetalGreyColor: number;
  emissiveMetallic: number;
  emissiveDielectric: number;
}

export const defaultBrightenParams: BrightenParams = {
  minLuminance: 0.08,
  metallicLumTarget: 0.22,
  maxBoostFactor: 5.0,
  minChannelFraction: 0.5,
  metallicThreshold: 0.4,
  maxMetalness: 0.2,
  texturedMetalnessThreshold: 0.3,
  texturedEmissive: 0.05,
  highMetalnessThreshold: 0.8,
  highRoughnessThreshold: 0.8,
  extremeRoughness: 0.6,
  whiteMetalGreyColor: 0.45,
  emissiveMetallic: 0.06,
  emissiveDielectric: 0.03,
};

/** Type guard for MeshStandardMaterial (covers MeshPhysicalMaterial too). */
function isStandardMaterial(mat: THREE.Material): mat is THREE.MeshStandardMaterial {
  return "color" in mat && "metalness" in mat && "roughness" in mat;
}

/** Compute perceptual luminance of a linear-sRGB color (Rec. 709). */
export function luminance(c: THREE.Color): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * Clone materials on every mesh so each mesh gets its own material instance.
 * This allows per-mesh material tweaks (e.g. brightening) without affecting
 * other meshes that originally shared the same material in the GLB.
 */
export function cloneMaterialsPerMesh(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    if (Array.isArray(child.material)) {
      child.material = child.material.map((m: THREE.Material) => m.clone());
    } else {
      child.material = child.material.clone();
    }
  });
}

/**
 * Case 0: Fix dark textured materials.
 * Metallic + textured is a common dark-material pattern. Reduce metalness so
 * diffuse light can reflect off the surface, and add a small emissive boost.
 */
function fixDarkTexturedMaterial(mat: THREE.MeshStandardMaterial, p: BrightenParams): void {
  if (!mat.map) return;
  if (mat.metalness <= p.texturedMetalnessThreshold) return;

  mat.metalness = p.maxMetalness;
  const eLum = luminance(mat.emissive);
  if (eLum < 0.03) {
    mat.emissive.setRGB(p.texturedEmissive, p.texturedEmissive, p.texturedEmissive * 1.2);
  }
  mat.needsUpdate = true;
}

/**
 * Case 1: Brighten dark base colors.
 * Dark metallic materials get an extra-aggressive boost because even after
 * capping metalness they remain very dim.
 */
function brightenDarkBaseColor(mat: THREE.MeshStandardMaterial, lum: number, p: BrightenParams): void {
  if (lum >= p.minLuminance) return;

  const c = mat.color;
  const targetLum = mat.metalness > p.metallicThreshold ? p.metallicLumTarget : p.minLuminance;
  const boost = targetLum / Math.max(lum, 0.001);
  const factor = Math.min(boost, p.maxBoostFactor);
  c.multiplyScalar(factor);
  const minChannel = targetLum * p.minChannelFraction;
  c.r = Math.max(c.r, minChannel);
  c.g = Math.max(c.g, minChannel);
  c.b = Math.max(c.b, minChannel);
  mat.needsUpdate = true;
}

/**
 * Case 2: Cap metalness so ambient/diffuse light is reflected.
 * Without an environment map, metallic materials rely entirely on specular
 * reflections from direct lights, making them near-black from most angles.
 */
function capMetalness(mat: THREE.MeshStandardMaterial, lum: number, p: BrightenParams): void {
  if (mat.metalness <= p.metallicThreshold) return;

  if (mat.metalness > p.highMetalnessThreshold && mat.roughness > p.highRoughnessThreshold) {
    // High metalness + high roughness: convert fully to dielectric.
    mat.metalness = 0.0;
    mat.roughness = p.extremeRoughness;
    if (lum > 0.8) {
      mat.color.setRGB(p.whiteMetalGreyColor, p.whiteMetalGreyColor, p.whiteMetalGreyColor + 0.03);
    }
  } else {
    mat.metalness = Math.min(mat.metalness, p.maxMetalness);
  }
  mat.needsUpdate = true;
}

/**
 * Case 3: Emissive boost on dark parts — stronger for originally-metallic
 * materials so they read clearly against the dark background.
 */
function boostDarkEmissive(
  mat: THREE.MeshStandardMaterial,
  lum: number,
  originalMetalness: number,
  p: BrightenParams
): void {
  if (lum >= p.minLuminance) return;

  const eLum = luminance(mat.emissive);
  if (eLum < 0.03) {
    const emStr = originalMetalness > p.metallicThreshold ? p.emissiveMetallic : p.emissiveDielectric;
    mat.emissive.setRGB(emStr, emStr, emStr * 1.1);
    mat.needsUpdate = true;
  }
}

/**
 * Traverse a model and lighten any very dark materials so they're visible
 * against the dark space background. Handles dark base colors, high metalness
 * on dark surfaces, and textured metallic materials.
 *
 * @param root - The root object to traverse
 * @param skipMeshNames - Set of mesh names to skip (e.g. mirrors that will be replaced)
 */
export function brightenDarkMaterials(root: THREE.Object3D, skipMeshNames?: Set<string>): void {
  const p = defaultBrightenParams;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    if (skipMeshNames?.has(child.name)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    materials.forEach((mat) => {
      if (!isStandardMaterial(mat)) return;

      const lum = luminance(mat.color);
      const originalMetalness = mat.metalness;

      fixDarkTexturedMaterial(mat, p);
      brightenDarkBaseColor(mat, lum, p);
      capMetalness(mat, lum, p);
      boostDarkEmissive(mat, lum, originalMetalness, p);
    });
  });
}
