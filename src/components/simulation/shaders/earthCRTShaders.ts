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
  uniform sampler2D uTexture;
  uniform float uGridDensity;
  uniform float uGridThickness;
  uniform float uGridAntialiasWidth;
  uniform vec3 uGridColor;
  varying vec2 vUv;

  // Calculate luminance from RGB (renamed to avoid conflict with built-in functions)
  float calculateLuminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    // Sample the original texture
    vec4 texColor = texture2D(uTexture, vUv);
    vec3 color = texColor.rgb;
    
    // Mask out the water, which are areas of green.
    bool isWater = color.g < 0.5;
    if (isWater) {
      // color = vec3(0.0117647059, 0.0235294118, 0.0431372549);
      color = vec3(0.15);
    } else {
      // Grid lines - detect both horizontal and vertical lines
      vec2 gridUV = vUv * uGridDensity;
      vec2 grid = abs(fract(gridUV) - 0.5);
    
      // Calculate distance from grid line center (either horizontal or vertical)
      // grid.x is small near vertical lines, grid.y is small near horizontal lines
      float dist = min(grid.x, grid.y);
    
      // Calculate screen-space derivative for distance-based antialiasing
      float distDeriv = fwidth(dist);
    
      // Use smoothstep with antialiasing for smooth grid line transitions
      // Edge0: start fading at (thickness - antialiasWidth)
      // Edge1: fully opaque at thickness
      float edge0 = uGridThickness - uGridAntialiasWidth * distDeriv;
      float edge1 = uGridThickness + uGridAntialiasWidth * distDeriv;
      float onLine = 1.0 - smoothstep(edge0, edge1, dist);
    
      // Use bright neon green for grid lines with glow effect
      color = mix(vec3(0.0), uGridColor, onLine);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;
