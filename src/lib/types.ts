export interface CarouselItem {
  title: string;
  description: string;
  model: string;
  camera: {
    position: { x: number; y: number; z: number };
    lookAt: { x: number; y: number; z: number };
  };
}

/**
 * Configuration for a single GLB model that can appear in the carousel.
 * The `name` field matches the `model` value in carousel.yaml.
 */
export interface ModelConfig {
  /** Identifier used to reference this model from carousel.yaml slides. */
  name: string;
  /** Path to the GLB file (relative to static/). */
  url: string;
  /** Uniform scale applied to the model wrapper group. */
  scale: number;
  /** Whether to run metallic material enhancement on load. */
  brighten: boolean;
  /** Mesh name to replace with a planar Reflector (mirror effect). */
  mirrorMeshName?: string;
}
