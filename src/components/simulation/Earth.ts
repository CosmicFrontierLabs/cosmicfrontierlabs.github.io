import * as THREE from "three";
import { simulationConfig } from "./simulationConfig";
import { earthCRTVertexShader, earthCRTFragmentShader } from "./shaders/earthCRTShaders";

/**
 * Earth mesh with texture and rotation animation
 * Creates a textured sphere representing Earth
 */
export class Earth {
  mesh: THREE.Mesh | null = null;
  private geometry: THREE.SphereGeometry;
  private material: THREE.ShaderMaterial | null = null;
  private texture: THREE.Texture | null = null;
  private rotationSpeed: number;
  private scene: THREE.Scene;
  private time: number;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    const config = simulationConfig.earth;
    this.scene = scene;
    this.rotationSpeed = config.rotationSpeed;
    this.geometry = new THREE.SphereGeometry(config.radius, config.segments, config.segments);
    this.time = 0.0;

    // Load texture asynchronously
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      config.textureUrl,
      (texture) => {
        this.texture = texture;
        // Configure texture settings
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

        // Create CRT shader material
        // Note: ShaderMaterial doesn't respond to lights by default
        // We'll make it self-illuminated by using the texture colors directly
        this.material = new THREE.ShaderMaterial({
          vertexShader: earthCRTVertexShader,
          fragmentShader: earthCRTFragmentShader,
          uniforms: {
            uTexture: { value: texture },
            uGridDensity: { value: 180.0 }, // Grid density (higher = more lines)
            uGridThickness: { value: 0.2 }, // Grid line thickness
            uGridAntialiasWidth: { value: 0.5 }, // Antialiasing width for smooth grid edges
            uGridColor: { value: new THREE.Color(simulationConfig.baseColor) }, // Bright neon CRT green
            uTime: { value: this.time },
          },
          transparent: false,
          depthTest: true,
          depthWrite: true,
          side: THREE.FrontSide,
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.copy(config.position);
        this.scene.add(this.mesh);
      },
      undefined,
      (error) => {
        console.error("Error loading earth texture:", error);
      }
    );
  }

  /**
   * Updates Earth's rotation based on elapsed time
   * @param delta - Time delta in seconds
   */
  update(delta: number): void {
    if (this.mesh) {
      this.mesh.rotation.y += this.rotationSpeed * delta;
    }

    if (this.material) {
      this.time += delta;
      this.material.uniforms.uTime.value = this.time; 
    }
  }

  /**
   * Disposes of Earth's resources
   */
  dispose(): void {
    if (this.texture) {
      this.texture.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.mesh) {
      this.scene.remove(this.mesh);
    }
    this.mesh = null;
    this.material = null;
    this.texture = null;
  }
}
