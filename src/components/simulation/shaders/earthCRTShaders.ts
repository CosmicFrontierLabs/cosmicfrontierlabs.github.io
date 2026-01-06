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
  const vec3 RED = vec3(0.99, 0.55, 0.55);

  // Band configuration
  const float BAND_EDGE_WIDTH = 0.04;
  const int NUM_RED_BANDS = 6;
  const int NUM_CYAN_BANDS = 3;
  
  // Red band positions (y-coordinate ranges)
  const float RED_BANDS[NUM_RED_BANDS] = float[](
    0.52,
    0.55,
    0.65,
    0.70,
    0.73,
    0.78
  );
  
  // Cyan band positions (y-coordinate ranges)
  const vec2 CYAN_BANDS[NUM_CYAN_BANDS] = vec2[](
    vec2(0.53, 0.55),
    vec2(0.66, 0.70),
    vec2(0.75, 0.77)
  );

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

  float applyBand(vec2 band, float edgeWidth) {
    float t =
      smoothstep(band.x - edgeWidth, band.x + edgeWidth, vUv.y) *
      (1.0 - smoothstep(band.y - edgeWidth, band.y + edgeWidth, vUv.y));
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

    // Apply red bands
    for (int i = 0; i < NUM_RED_BANDS; i++) {
      vec2 band = vec2(RED_BANDS[i], RED_BANDS[i] + 0.01);
      float t = applyBand(band, BAND_EDGE_WIDTH);
      color = mix(color, RED, t * gridLine * (0.6 + vUv.y));
    }

    // Apply cyan bands
    for (int i = 0; i < NUM_CYAN_BANDS; i++) {
      float t = applyBand(CYAN_BANDS[i], BAND_EDGE_WIDTH);
      color = mix(color, CYAN, t * gridLine);
    }

    // Mask out water to the background color
    vec4 texture = texture2D(uTexture, vUv);
    float isWater = 1.0 - step(0.5, texture.g);
    color = mix(color, BG_COLOR, isWater);

    gl_FragColor = vec4(color, 1.0);
  }
`;
