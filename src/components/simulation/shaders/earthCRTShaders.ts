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
  const vec3 BG_COLOR = vec3(0.16, 0.15, 0.15);
  const vec3 GRID_COLOR = vec3(0.99, 0.92, 0.92);
  const vec3 CYAN = vec3(0.55, 0.95, 0.95);

  uniform sampler2D uTexture;
  uniform float uGridDensity;
  uniform float uGridThickness;
  uniform float uGridAntialiasWidth;
  varying vec2 vUv;

  float inverseLerp(float value, float inMin, float inMax) {
    return (value - inMin) / (inMax - inMin);
  }
  
  float remap(float value, float inMin, float inMax, float outMin, float outMax) {
    return inverseLerp(value, inMin, inMax) * (outMax - outMin) + outMin;
  }

  float applyBand(vec2 band) {
    float edge = 0.04;
    float t =
      smoothstep(band.x - edge, band.x + edge, vUv.y) *
      (1.0 - smoothstep(band.y - edge, band.y + edge, vUv.y));
    return t;
  }

  void main() {
    vec3 color = BG_COLOR;

    // Add the grid
    vec2 gridUV = vUv * uGridDensity * 1.0;
    vec2 grid = abs(fract(gridUV) - 0.5);
    float gridDist = min(grid.x, grid.y);

    // For Anti-aliasing.
    // Disable anti-aliasing for a more CRT-like texture to the earth
    // float distDeriv = fwidth(gridDist);
    // float edge0 = uGridThickness - uGridAntialiasWidth * distDeriv;
    // float edge1 = uGridThickness + uGridAntialiasWidth * distDeriv;

    float edge0 = uGridThickness;
    float edge1 = uGridThickness;

    float gridLine = 1.0 - smoothstep(edge0, edge1, gridDist);
    color = mix(color, GRID_COLOR, gridLine);

    vec2 cyanBand = vec2(0.66, 0.70);
    float tCyan = applyBand(cyanBand);
    color = mix(color, CYAN, tCyan * gridLine);

    cyanBand = vec2(0.53, 0.55);
    tCyan = applyBand(cyanBand);
    color = mix(color, CYAN, tCyan * gridLine);

    cyanBand = vec2(0.75, 0.76);
    tCyan = applyBand(cyanBand);
    color = mix(color, CYAN, tCyan * gridLine);

    // Mask out water to the background color
    vec4 texture = texture2D(uTexture, vUv);
    float isWater = 1.0 - step(0.5, texture.g);
    color = mix(color, BG_COLOR, isWater);

    gl_FragColor = vec4(color, 1.0);
  }
`;
