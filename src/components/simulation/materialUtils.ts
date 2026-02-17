import * as THREE from "three";

// --- Metallic material enhancement parameters ---
interface MetallicEnhanceParams {
  /** Minimum base-color luminance; darker colors get boosted to this. */
  minLuminance: number;
  /** Maximum color boost multiplier to avoid extreme blowout. */
  maxBoostFactor: number;
  /** Metalness floor — materials below this get bumped up. */
  minMetalness: number;
  /** Metalness applied to originally non-metallic surfaces for a subtle sheen. */
  dielectricMetalness: number;
  /** Roughness cap for metallic surfaces to ensure visible reflections. */
  maxRoughness: number;
  /** Roughness for originally very rough metallic surfaces (brushed metal look). */
  brushedMetalRoughness: number;
  /** Threshold above which a material is considered "originally metallic". */
  metallicThreshold: number;
  /** Subtle emissive boost for very dark metallic parts so they read against space. */
  emissiveBoost: number;
  /** Base color tint for very bright (white) metals to give them a cooler steel tone. */
  whiteMetalColor: THREE.Color;
}

const defaultMetallicParams: MetallicEnhanceParams = {
  minLuminance: 0.06,
  maxBoostFactor: 4.0,
  minMetalness: 0.7,
  dielectricMetalness: 0.15,
  maxRoughness: 0.35,
  brushedMetalRoughness: 0.45,
  metallicThreshold: 0.4,
  emissiveBoost: 0.04,
  whiteMetalColor: new THREE.Color(0.7, 0.72, 0.78),
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
 * This allows per-mesh material tweaks without affecting other meshes that
 * originally shared the same material in the GLB.
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
 * Enhance materials for a metallic telescope look. Designed to work with an
 * HDR environment map providing reflections. Instead of suppressing metalness
 * (the old approach), this preserves and enhances it so surfaces pick up
 * environment reflections and look like real machined/anodised metal.
 *
 * @param root - The root object to traverse
 * @param skipMeshNames - Set of mesh names to skip (e.g. mirrors that will be replaced)
 */
export function enhanceMetallicMaterials(root: THREE.Object3D, skipMeshNames?: Set<string>): void {
  const p = defaultMetallicParams;

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    if (skipMeshNames?.has(child.name)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];

    materials.forEach((mat) => {
      if (!isStandardMaterial(mat)) return;

      const lum = luminance(mat.color);
      const origMetalness = mat.metalness;
      const isOriginallyMetallic = origMetalness > p.metallicThreshold;

      // --- Brighten very dark base colors so they're not invisible ---
      if (lum < p.minLuminance) {
        const boost = Math.min(p.minLuminance / Math.max(lum, 0.001), p.maxBoostFactor);
        mat.color.multiplyScalar(boost);
        mat.color.r = Math.max(mat.color.r, p.minLuminance * 0.5);
        mat.color.g = Math.max(mat.color.g, p.minLuminance * 0.5);
        mat.color.b = Math.max(mat.color.b, p.minLuminance * 0.5);
      }

      // --- Tint very bright metals to a cool steel tone ---
      if (isOriginallyMetallic && lum > 0.8) {
        mat.color.copy(p.whiteMetalColor);
      }

      // --- Enhance metalness ---
      if (isOriginallyMetallic) {
        // Originally metallic: ensure high metalness for strong reflections
        mat.metalness = Math.max(mat.metalness, p.minMetalness);

        // Tighten roughness for polished/brushed metal appearance
        if (mat.roughness > p.brushedMetalRoughness) {
          // Very rough metals become brushed-metal; others get polished
          mat.roughness = mat.roughness > 0.8 ? p.brushedMetalRoughness : p.maxRoughness;
        }
      } else {
        // Originally dielectric: give a subtle metallic sheen
        mat.metalness = Math.max(mat.metalness, p.dielectricMetalness);
        // Slightly reduce roughness for sharper reflections
        mat.roughness = Math.min(mat.roughness, 0.7);
      }

      // --- Textured metallic surfaces: preserve texture, boost metalness ---
      if (mat.map && origMetalness > p.metallicThreshold) {
        mat.metalness = Math.max(mat.metalness, p.minMetalness);
        mat.roughness = Math.min(mat.roughness, p.maxRoughness);
      }

      // --- Subtle emissive for very dark metallic parts ---
      if (lum < p.minLuminance && isOriginallyMetallic) {
        const eLum = luminance(mat.emissive);
        if (eLum < 0.02) {
          mat.emissive.setRGB(p.emissiveBoost, p.emissiveBoost, p.emissiveBoost * 1.1);
        }
      }

      mat.needsUpdate = true;
    });
  });
}
