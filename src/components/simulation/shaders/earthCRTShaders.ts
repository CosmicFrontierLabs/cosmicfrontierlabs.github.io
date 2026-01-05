/**
 * Vertex shader for Earth CRT effect
 * Standard pass-through for sphere geometry with UV coordinates
 */
export const earthCRTVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Fragment shader for Earth CRT effect
 * Converts greenish pixels to black and overlays green grid on white areas
 */
export const earthCRTFragmentShader = `
  const vec3 BG_COLOR = vec3(0.15);
  const vec3 CYAN = vec3(0.0, 1.0, 1.0);
  uniform sampler2D uTexture;
  uniform float uGridDensity;
  uniform float uGridThickness;
  uniform float uGridAntialiasWidth;
  uniform vec3 uGridColor;
  varying vec2 vUv;

  float inverseLerp(float value, float inMin, float inMax) {
    return (value - inMin) / (inMax - inMin);
  }
  
  float remap(float value, float inMin, float inMax, float outMin, float outMax) {
    return inverseLerp(value, inMin, inMax) * (outMax - outMin) + outMin;
  }

  void main() {
    vec3 color = BG_COLOR;

    // Add the grid
    vec2 gridUV = vUv * uGridDensity * 1.0;
    vec2 grid = abs(fract(gridUV) - 0.5);
    float gridDist = min(grid.x, grid.y);
    float distDeriv = fwidth(gridDist);
    float edge0 = uGridThickness - uGridAntialiasWidth * distDeriv;
    float edge1 = uGridThickness + uGridAntialiasWidth * distDeriv;
    float gridLine = 1.0 - smoothstep(edge0, edge1, gridDist);
    color = mix(color, uGridColor, gridLine);

    // Apply the cyan effect
    float cyanEdge = 0.05;
    vec2 band = vec2(0.7, 0.9);
    float t1 =
      smoothstep(band.x - cyanEdge, band.x + cyanEdge, vUv.y) * 
      (1.0 - smoothstep(band.y - cyanEdge, band.y + cyanEdge, vUv.y));
    t1 = remap(t1, 0.0, 1.0, 0.0, 1.0);
    color = mix(color, CYAN, t1 * gridLine);

    // Mask out water to the background color
    vec4 texture = texture2D(uTexture, vUv);
    float isWater = 1.0 - step(0.5, texture.g);
    color = mix(color, BG_COLOR, isWater);

    gl_FragColor = vec4(color, 1.0);
  }
`;
